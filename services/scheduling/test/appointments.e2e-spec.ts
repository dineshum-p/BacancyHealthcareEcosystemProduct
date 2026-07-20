import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AccessTokenPayload, AppointmentSummary } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { NOTIFICATION_SERVICE_CLIENT } from '../src/notifications/clients/notification-service.client';
import type { NotificationServiceClient } from '../src/notifications/clients/notification-service.client';
import { AuditLogsRepository } from '../src/audit-logs/audit-logs.repository';
import { AppointmentSchemaProvisioner } from '../src/appointments/appointment-schema.provisioner';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-scheduling-test-secret';

/**
 * Proves BAC-16's acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`), the same approach every other service in
 * this repo established: production and `docker-compose.test.yml` both use
 * the real `pg` driver against real Postgres; only `PG_POOL` is swapped
 * here. `NOTIFICATION_SERVICE_CLIENT` is also swapped for a fake spy so the
 * confirmation-notification AC can be asserted without a real HTTP call to
 * `services/notification` (mirrors `services/patient`'s BAC-14
 * `DOMAIN_EVENT_PUBLISHER` fake-client convention).
 *
 * `services/scheduling` never issues tokens itself, so tests sign tokens
 * with a plain `JwtService` using the SAME secret this app is configured
 * with -- standing in for `services/auth`'s own token issuance, mirroring
 * every other service's e2e pattern exactly.
 */
describe('Appointment booking and management (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let fakeNotificationClient: jest.Mocked<NotificationServiceClient>;
  let auditLogsRepository: AuditLogsRepository;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();
    fakeNotificationClient = {
      sendAppointmentConfirmation: jest
        .fn()
        .mockResolvedValue({ outcome: 'succeeded' }),
    };
    auditLogsRepository = new AuditLogsRepository(
      pool,
      new AppointmentSchemaProvisioner(pool),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(NOTIFICATION_SERVICE_CLIENT)
      .useValue(fakeNotificationClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    fakeNotificationClient.sendAppointmentConfirmation.mockClear();
  });

  function signToken(payload: AccessTokenPayload): string {
    return jwtService.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: 900,
    });
  }

  function tokenFor(
    tenant: { id: string },
    role: AccessTokenPayload['role'] = 'staff',
    userId = 'user-1',
  ): string {
    return signToken({ userId, tenantId: tenant.id, role });
  }

  function bookPayload(overrides: Record<string, unknown> = {}) {
    return {
      providerId: 'provider-1',
      patientId: 'patient-1',
      startTime: '2026-07-20T09:00:00.000Z',
      endTime: '2026-07-20T09:30:00.000Z',
      notifyChannel: 'email',
      notifyTo: 'patient@example.com',
      ...overrides,
    };
  }

  describe('AC1: POST /appointments', () => {
    it('books a slot for a patient with a single provider and returns 201', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(bookPayload())
        .expect(201);

      const body = response.body as AppointmentSummary;
      expect(body.id).toEqual(expect.any(String));
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.providerId).toBe('provider-1');
      expect(body.patientId).toBe('patient-1');
      expect(body.status).toBe('booked');
    });

    it('returns 409 when double-booking the same slot', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          bookPayload({
            providerId: 'provider-double-book',
            startTime: '2026-07-20T10:00:00.000Z',
            endTime: '2026-07-20T10:30:00.000Z',
          }),
        )
        .expect(201);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          bookPayload({
            providerId: 'provider-double-book',
            patientId: 'patient-2',
            startTime: '2026-07-20T10:00:00.000Z',
            endTime: '2026-07-20T10:30:00.000Z',
          }),
        )
        .expect(409);
    });

    it('rejects a payload missing required fields with 400', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ providerId: 'provider-1' })
        .expect(400);
    });

    it('triggers a confirmation notification after a successful booking (AC4)', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          bookPayload({
            providerId: 'provider-notify',
            startTime: '2026-07-20T11:00:00.000Z',
            endTime: '2026-07-20T11:30:00.000Z',
          }),
        )
        .expect(201);

      const body = response.body as AppointmentSummary;
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        fakeNotificationClient.sendAppointmentConfirmation,
      ).toHaveBeenCalledWith(
        tenants.tenantA.id,
        'email',
        'patient@example.com',
        expect.objectContaining({ id: body.id }),
      );
    });

    it('writes an audit log entry for the booking (AC4)', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          bookPayload({
            providerId: 'provider-audit',
            startTime: '2026-07-20T12:00:00.000Z',
            endTime: '2026-07-20T12:30:00.000Z',
          }),
        )
        .expect(201);

      const body = response.body as AppointmentSummary;
      const entries = await auditLogsRepository.findAll(
        tenants.tenantA.schemaName,
      );
      const entry = entries.find((e) => e.resourceId === body.id);
      expect(entry).toBeDefined();
      expect(entry?.resourceType).toBe('Appointment');
      expect(entry?.action).toBe('create');
      expect(entry?.actorUserId).toBe('user-1');
    });

    describe('RBAC', () => {
      it('allows clinic_admin/staff to book for ANY provider (cross-provider, front-desk booking)', async () => {
        const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-1');

        await request(app.getHttpServer())
          .post('/appointments')
          .set('X-Tenant-Id', tenants.tenantA.slug)
          .set('Authorization', `Bearer ${token}`)
          .send(
            bookPayload({
              providerId: 'someone-elses-calendar',
              startTime: '2026-07-20T13:00:00.000Z',
              endTime: '2026-07-20T13:30:00.000Z',
            }),
          )
          .expect(201);
      });

      it("forbids a provider from booking on a DIFFERENT provider's calendar", async () => {
        const token = tokenFor(tenants.tenantA, 'provider', 'provider-self');

        await request(app.getHttpServer())
          .post('/appointments')
          .set('X-Tenant-Id', tenants.tenantA.slug)
          .set('Authorization', `Bearer ${token}`)
          .send(
            bookPayload({
              providerId: 'a-different-provider',
              startTime: '2026-07-20T14:00:00.000Z',
              endTime: '2026-07-20T14:30:00.000Z',
            }),
          )
          .expect(403);
      });

      it('allows a provider to book on their OWN calendar', async () => {
        const token = tokenFor(tenants.tenantA, 'provider', 'provider-self-2');

        await request(app.getHttpServer())
          .post('/appointments')
          .set('X-Tenant-Id', tenants.tenantA.slug)
          .set('Authorization', `Bearer ${token}`)
          .send(
            bookPayload({
              providerId: 'provider-self-2',
              startTime: '2026-07-20T16:00:00.000Z',
              endTime: '2026-07-20T16:30:00.000Z',
            }),
          )
          .expect(201);
      });
    });
  });

  describe('AC2: GET /appointments?date', () => {
    beforeAll(async () => {
      const token = tokenFor(tenants.tenantB, 'clinic_admin', 'admin-b');
      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          bookPayload({
            providerId: 'provider-b-1',
            startTime: '2026-08-01T09:00:00.000Z',
            endTime: '2026-08-01T09:30:00.000Z',
          }),
        )
        .expect(201);
      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          bookPayload({
            providerId: 'provider-b-2',
            startTime: '2026-08-01T10:00:00.000Z',
            endTime: '2026-08-01T10:30:00.000Z',
          }),
        )
        .expect(201);
    });

    it("returns the requested provider's day schedule, tenant-scoped", async () => {
      const token = tokenFor(tenants.tenantB, 'clinic_admin', 'admin-b');

      const response = await request(app.getHttpServer())
        .get('/appointments')
        .query({ date: '2026-08-01', providerId: 'provider-b-1' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as AppointmentSummary[];
      expect(body).toHaveLength(1);
      expect(body[0].providerId).toBe('provider-b-1');
      expect(body[0].tenantId).toBe(tenants.tenantB.id);
    });

    it('requires providerId for clinic_admin/staff (400 if missing)', async () => {
      const token = tokenFor(tenants.tenantB, 'clinic_admin', 'admin-b');

      await request(app.getHttpServer())
        .get('/appointments')
        .query({ date: '2026-08-01' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it("scopes a provider's query to their OWN calendar only", async () => {
      const token = tokenFor(tenants.tenantB, 'provider', 'provider-b-2');

      const response = await request(app.getHttpServer())
        .get('/appointments')
        .query({ date: '2026-08-01' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as AppointmentSummary[];
      expect(body.every((a) => a.providerId === 'provider-b-2')).toBe(true);
    });

    it("forbids a provider from querying a DIFFERENT provider's day", async () => {
      const token = tokenFor(tenants.tenantB, 'provider', 'provider-b-2');

      await request(app.getHttpServer())
        .get('/appointments')
        .query({ date: '2026-08-01', providerId: 'provider-b-1' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it("never returns a different tenant's appointments", async () => {
      const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-a');

      const response = await request(app.getHttpServer())
        .get('/appointments')
        .query({ date: '2026-08-01', providerId: 'provider-b-1' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('AC3: PATCH /appointments/:id', () => {
    async function bookAndReturnId(overrides: Record<string, unknown> = {}) {
      const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-a');
      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(bookPayload(overrides))
        .expect(201);
      return (response.body as AppointmentSummary).id;
    }

    it('reschedules a booked appointment to a new time', async () => {
      const id = await bookAndReturnId({
        providerId: 'provider-reschedule',
        startTime: '2026-07-21T09:00:00.000Z',
        endTime: '2026-07-21T09:30:00.000Z',
      });
      const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-a');

      const response = await request(app.getHttpServer())
        .patch(`/appointments/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'reschedule',
          startTime: '2026-07-21T15:00:00.000Z',
          endTime: '2026-07-21T15:30:00.000Z',
        })
        .expect(200);

      const body = response.body as AppointmentSummary;
      expect(body.startTime).toBe('2026-07-21T15:00:00.000Z');
      expect(body.status).toBe('booked');
    });

    it('cancels a booked appointment, recording the status transition', async () => {
      const id = await bookAndReturnId({
        providerId: 'provider-cancel',
        startTime: '2026-07-22T09:00:00.000Z',
        endTime: '2026-07-22T09:30:00.000Z',
      });
      const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-a');

      const response = await request(app.getHttpServer())
        .patch(`/appointments/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'cancel' })
        .expect(200);

      expect((response.body as AppointmentSummary).status).toBe('cancelled');
    });

    it('returns 404 for an unknown appointment id', async () => {
      const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-a');

      await request(app.getHttpServer())
        .patch('/appointments/00000000-0000-0000-0000-000000000000')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'cancel' })
        .expect(404);
    });

    it('returns 409 when rescheduling into an overlapping booked slot', async () => {
      await bookAndReturnId({
        providerId: 'provider-conflict',
        startTime: '2026-07-23T09:00:00.000Z',
        endTime: '2026-07-23T09:30:00.000Z',
      });
      const movingId = await bookAndReturnId({
        providerId: 'provider-conflict',
        startTime: '2026-07-23T11:00:00.000Z',
        endTime: '2026-07-23T11:30:00.000Z',
      });
      const token = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-a');

      await request(app.getHttpServer())
        .patch(`/appointments/${movingId}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'reschedule',
          startTime: '2026-07-23T09:00:00.000Z',
          endTime: '2026-07-23T09:30:00.000Z',
        })
        .expect(409);
    });

    it("forbids a provider from modifying a DIFFERENT provider's appointment", async () => {
      const id = await bookAndReturnId({
        providerId: 'provider-owned-by-someone-else',
        startTime: '2026-07-24T09:00:00.000Z',
        endTime: '2026-07-24T09:30:00.000Z',
      });
      const token = tokenFor(
        tenants.tenantA,
        'provider',
        'a-different-provider',
      );

      await request(app.getHttpServer())
        .patch(`/appointments/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'cancel' })
        .expect(403);
    });

    it('allows a provider to cancel their OWN appointment', async () => {
      const id = await bookAndReturnId({
        providerId: 'provider-cancels-own',
        startTime: '2026-07-25T09:00:00.000Z',
        endTime: '2026-07-25T09:30:00.000Z',
      });
      const token = tokenFor(
        tenants.tenantA,
        'provider',
        'provider-cancels-own',
      );

      await request(app.getHttpServer())
        .patch(`/appointments/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'cancel' })
        .expect(200);
    });
  });

  describe('tenant/auth guard composition (shared with every route)', () => {
    it('rejects POST /appointments with no Authorization header (401)', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send(bookPayload())
        .expect(401);
    });

    it('rejects POST /appointments with no X-Tenant-Id (404)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send(bookPayload())
        .expect(404);
    });

    it('rejects POST /appointments for an inactive tenant (403)', async () => {
      const token = tokenFor(tenants.inactiveTenant);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.inactiveTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(bookPayload())
        .expect(403);
    });

    it('rejects a token issued for a DIFFERENT tenant than X-Tenant-Id claims (401)', async () => {
      const tokenForTenantB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenForTenantB}`)
        .send(bookPayload())
        .expect(401);
    });
  });
});
