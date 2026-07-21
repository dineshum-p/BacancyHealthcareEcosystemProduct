import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool, QueryResult } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  AppointmentSummary,
  VisitIntakeSummary,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { NOTIFICATION_SERVICE_CLIENT } from '../src/notifications/clients/notification-service.client';
import type { NotificationServiceClient } from '../src/notifications/clients/notification-service.client';
import { quoteSchemaIdentifier } from '../src/tenants/schema-identifier.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-scheduling-test-secret';

/**
 * Proves BAC-45's acceptance criteria end-to-end against a real (not mocked)
 * SQL engine (`pg-mem`, with the fake `pgcrypto` shim from
 * `test/support/create-in-memory-pool.ts`), the same approach
 * `test/appointments.e2e-spec.ts` established.
 */
describe('Visit intakes (e2e, BAC-45)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
    process.env.PGCRYPTO_COLUMN_KEY = 'e2e-visit-intake-column-key';

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();
    const fakeNotificationClient: jest.Mocked<NotificationServiceClient> = {
      sendAppointmentConfirmation: jest
        .fn()
        .mockResolvedValue({ outcome: 'succeeded' }),
    };

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

  function intakePayload(overrides: Record<string, unknown> = {}) {
    return {
      reasonForVisit: 'Recurring migraines',
      symptoms: 'Throbbing pain, light sensitivity',
      whatsNewSinceLastVisit: 'Started a new job, more stress',
      ...overrides,
    };
  }

  async function bookAppointment(
    tenant: SeededTenants['tenantA'],
    providerId: string,
    patientId: string,
    startTime: string,
    endTime: string,
  ): Promise<string> {
    const token = tokenFor(tenant, 'clinic_admin', 'admin-1');
    const response = await request(app.getHttpServer())
      .post('/appointments')
      .set('X-Tenant-Id', tenant.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        providerId,
        patientId,
        startTime,
        endTime,
        notifyChannel: 'email',
        notifyTo: 'patient@example.com',
      })
      .expect(201);
    return (response.body as AppointmentSummary).id;
  }

  describe('AC1: POST /visit-intakes', () => {
    it('creates a pending intake for a logged-in patient, not yet linked to any appointment', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-1');

      const response = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload())
        .expect(201);

      const body = response.body as VisitIntakeSummary;
      expect(body.id).toEqual(expect.any(String));
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.patientId).toBe('patient-1');
      expect(body.reasonForVisit).toBe('Recurring migraines');
      expect(body.symptoms).toBe('Throbbing pain, light sensitivity');
      expect(body.whatsNewSinceLastVisit).toBe(
        'Started a new job, more stress',
      );
      expect(body.status).toBe('pending');
      expect(body.assignedProviderId).toBeNull();
      expect(body.appointmentId).toBeNull();
    });

    it("takes patientId from the caller's own token when the body carries none", async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-self-scope');

      const response = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload())
        .expect(201);

      expect((response.body as VisitIntakeSummary).patientId).toBe(
        'patient-self-scope',
      );
    });

    it('rejects a body that attempts to smuggle a patientId field with 400 (whitelist validation; CreateVisitIntakeDto declares no such field)', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-self-scope');

      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...intakePayload(), patientId: 'someone-elses-id' })
        .expect(400);
    });

    it('rejects a payload missing required fields with 400', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-1');

      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ reasonForVisit: 'Reason' })
        .expect(400);
    });

    it('forbids staff-side roles from submitting an intake (only a patient may create one)', async () => {
      const token = tokenFor(tenants.tenantA, 'staff', 'staff-1');

      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload())
        .expect(403);
    });

    it('AC5: creates a FRESH new intake every time a patient submits one, never merging into a prior submission', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-repeat');

      const first = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload({ reasonForVisit: 'First visit reason' }))
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload({ reasonForVisit: 'Second, unrelated visit' }))
        .expect(201);

      const firstBody = first.body as VisitIntakeSummary;
      const secondBody = second.body as VisitIntakeSummary;
      expect(firstBody.id).not.toBe(secondBody.id);
      expect(firstBody.reasonForVisit).toBe('First visit reason');
      expect(secondBody.reasonForVisit).toBe('Second, unrelated visit');
    });

    it('AC4: stores reasonForVisit/symptoms as pgcrypto-encrypted bytes, never plaintext, at the database layer', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-encrypted');

      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(
          intakePayload({
            reasonForVisit: 'VerySensitiveReasonForVisitContent',
            symptoms: 'VerySensitiveSymptomContent',
          }),
        )
        .expect(201);

      const raw: QueryResult<{ reason_for_visit: Buffer; symptoms: Buffer }> =
        await pool.query(
          `SELECT reason_for_visit, symptoms
           FROM ${quoteSchemaIdentifier(tenants.tenantA.schemaName)}.visit_intakes
           WHERE patient_id = $1`,
          ['patient-encrypted'],
        );
      expect(raw.rows).toHaveLength(1);
      expect(Buffer.isBuffer(raw.rows[0].reason_for_visit)).toBe(true);
      expect(raw.rows[0].reason_for_visit.toString('latin1')).not.toContain(
        'VerySensitiveReasonForVisitContent',
      );
      expect(raw.rows[0].symptoms.toString('latin1')).not.toContain(
        'VerySensitiveSymptomContent',
      );
    });
  });

  describe('AC2: GET /visit-intakes?status=pending (staff triage queue)', () => {
    it('returns all pending intakes across patients for staff', async () => {
      const patientToken = tokenFor(tenants.tenantB, 'patient', 'patient-b-1');
      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(intakePayload({ reasonForVisit: 'Queue reason 1' }))
        .expect(201);

      const patientToken2 = tokenFor(tenants.tenantB, 'patient', 'patient-b-2');
      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${patientToken2}`)
        .send(intakePayload({ reasonForVisit: 'Queue reason 2' }))
        .expect(201);

      const staffToken = tokenFor(tenants.tenantB, 'clinic_admin', 'admin-b');
      const response = await request(app.getHttpServer())
        .get('/visit-intakes')
        .query({ status: 'pending' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const body = response.body as VisitIntakeSummary[];
      expect(body.length).toBeGreaterThanOrEqual(2);
      expect(body.every((intake) => intake.status === 'pending')).toBe(true);
      const patientIds = body.map((intake) => intake.patientId);
      expect(patientIds).toEqual(
        expect.arrayContaining(['patient-b-1', 'patient-b-2']),
      );
    });

    it('forbids a patient from reading the tenant-wide triage queue', async () => {
      const token = tokenFor(tenants.tenantB, 'patient', 'patient-b-1');

      await request(app.getHttpServer())
        .get('/visit-intakes')
        .query({ status: 'pending' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('forbids a provider from reading the tenant-wide triage queue', async () => {
      const token = tokenFor(tenants.tenantB, 'provider', 'provider-b-1');

      await request(app.getHttpServer())
        .get('/visit-intakes')
        .query({ status: 'pending' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('AC3: GET /visit-intakes/:id and PATCH /visit-intakes/:id/link', () => {
    it('allows the submitting patient to read their own intake', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-reader');
      const created = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload())
        .expect(201);
      const id = (created.body as VisitIntakeSummary).id;

      const response = await request(app.getHttpServer())
        .get(`/visit-intakes/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect((response.body as VisitIntakeSummary).id).toBe(id);
    });

    it("forbids a DIFFERENT patient from reading someone else's intake", async () => {
      const ownerToken = tokenFor(tenants.tenantA, 'patient', 'patient-owner');
      const created = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(intakePayload())
        .expect(201);
      const id = (created.body as VisitIntakeSummary).id;

      const otherToken = tokenFor(tenants.tenantA, 'patient', 'patient-other');
      await request(app.getHttpServer())
        .get(`/visit-intakes/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('links a provider + appointment to a pending intake, and thereafter ONLY that provider (not any other) may read it -- the assigned provider and the submitting patient still can', async () => {
      const patientToken = tokenFor(
        tenants.tenantA,
        'patient',
        'patient-linked',
      );
      const created = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(intakePayload())
        .expect(201);
      const intakeId = (created.body as VisitIntakeSummary).id;

      const appointmentId = await bookAppointment(
        tenants.tenantA,
        'provider-assigned',
        'patient-linked',
        '2026-07-20T09:00:00.000Z',
        '2026-07-20T09:30:00.000Z',
      );

      const staffToken = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-1');
      const linkResponse = await request(app.getHttpServer())
        .patch(`/visit-intakes/${intakeId}/link`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ providerId: 'provider-assigned', appointmentId })
        .expect(200);

      const linked = linkResponse.body as VisitIntakeSummary;
      expect(linked.status).toBe('linked');
      expect(linked.assignedProviderId).toBe('provider-assigned');
      expect(linked.appointmentId).toBe(appointmentId);

      // The assigned provider CAN read it.
      const assignedProviderToken = tokenFor(
        tenants.tenantA,
        'provider',
        'provider-assigned',
      );
      await request(app.getHttpServer())
        .get(`/visit-intakes/${intakeId}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${assignedProviderToken}`)
        .expect(200);

      // The submitting patient still can.
      await request(app.getHttpServer())
        .get(`/visit-intakes/${intakeId}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      // Any OTHER provider is 403'd.
      const otherProviderToken = tokenFor(
        tenants.tenantA,
        'provider',
        'a-different-provider',
      );
      await request(app.getHttpServer())
        .get(`/visit-intakes/${intakeId}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${otherProviderToken}`)
        .expect(403);
    });

    it('rejects linking when appointmentId is not actually booked with the given providerId (400)', async () => {
      const patientToken = tokenFor(
        tenants.tenantA,
        'patient',
        'patient-mismatch',
      );
      const created = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(intakePayload())
        .expect(201);
      const intakeId = (created.body as VisitIntakeSummary).id;

      const appointmentId = await bookAppointment(
        tenants.tenantA,
        'provider-real',
        'patient-mismatch',
        '2026-07-20T11:00:00.000Z',
        '2026-07-20T11:30:00.000Z',
      );

      const staffToken = tokenFor(tenants.tenantA, 'clinic_admin', 'admin-1');
      await request(app.getHttpServer())
        .patch(`/visit-intakes/${intakeId}/link`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ providerId: 'a-provider-who-did-not-book-this', appointmentId })
        .expect(400);
    });

    it('forbids a provider (non-staff) from calling the link mutation', async () => {
      const patientToken = tokenFor(
        tenants.tenantA,
        'patient',
        'patient-link-rbac',
      );
      const created = await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(intakePayload())
        .expect(201);
      const intakeId = (created.body as VisitIntakeSummary).id;

      const providerToken = tokenFor(tenants.tenantA, 'provider', 'provider-x');
      await request(app.getHttpServer())
        .patch(`/visit-intakes/${intakeId}/link`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ providerId: 'provider-x', appointmentId: 'appt-x' })
        .expect(403);
    });
  });

  describe('tenant/auth guard composition (shared with every route)', () => {
    it('rejects POST /visit-intakes with no Authorization header (401)', async () => {
      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send(intakePayload())
        .expect(401);
    });

    it('rejects POST /visit-intakes with no X-Tenant-Id (404)', async () => {
      const token = tokenFor(tenants.tenantA, 'patient', 'patient-1');

      await request(app.getHttpServer())
        .post('/visit-intakes')
        .set('Authorization', `Bearer ${token}`)
        .send(intakePayload())
        .expect(404);
    });
  });
});
