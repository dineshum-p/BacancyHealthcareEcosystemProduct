import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  PaginatedPatientsResponse,
  PatientSummary,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { DOMAIN_EVENT_PUBLISHER } from '../src/events/events.constants';
import { DomainEventPublisher } from '../src/events/domain-event-publisher.interface';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-patient-registration-test-secret';

/**
 * Proves BAC-14's four acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`), the same approach every other service in
 * this repo established: production and `docker-compose.test.yml` both use
 * the real `pg` driver against real Postgres; only `PG_POOL` is swapped
 * here. `DOMAIN_EVENT_PUBLISHER` is also swapped for a fake spy so AC4 can
 * be asserted without a real Kafka broker (mirrors
 * `services/notification`'s BAC-9 fake-client convention on the consuming
 * side).
 *
 * `services/patient` never issues tokens itself, so tests sign tokens with
 * a plain `JwtService` using the SAME secret this app is configured with --
 * standing in for `services/auth`'s own token issuance, mirroring
 * `services/emr`'s BAC-10/`services/billing`'s BAC-11 e2e pattern exactly.
 */
describe('Patient registration and search (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let fakeEventPublisher: jest.Mocked<DomainEventPublisher>;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();
    fakeEventPublisher = {
      publishPatientCreated: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(DOMAIN_EVENT_PUBLISHER)
      .useValue(fakeEventPublisher)
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
    fakeEventPublisher.publishPatientCreated.mockClear();
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
    role: AccessTokenPayload['role'] = 'clinic_admin',
  ): string {
    return signToken({ userId: 'user-1', tenantId: tenant.id, role });
  }

  describe('AC1: POST /patients', () => {
    it('registers a patient and returns 201 with a tenant-unique, sequential MRN', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        })
        .expect(201);

      const body = response.body as PatientSummary;
      expect(body.mrn).toBe('MRN-000001');
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.firstName).toBe('Jane');
      expect(body.lastName).toBe('Doe');
      expect(body.dateOfBirth).toBe('1990-05-12');
      expect(body.id).toEqual(expect.any(String));
    });

    it('assigns sequential MRNs to successive patients in the same tenant', async () => {
      const token = tokenFor(tenants.tenantA);

      const second = await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'John',
          lastName: 'Smith',
          dateOfBirth: '1985-01-01',
        })
        .expect(201);

      // A patient was already registered for tenantA in the prior test.
      expect((second.body as PatientSummary).mrn).toBe('MRN-000002');
    });

    it('rejects a payload missing required fields with 400', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Jane' })
        .expect(400);
    });

    it('rejects a STAFF role from registering a patient with 403 (RBAC: WRITE_PATIENT required)', async () => {
      const staffToken = tokenFor(tenants.tenantA, 'staff');

      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        })
        .expect(403);
    });

    it('allows a PROVIDER role to register a patient', async () => {
      const providerToken = tokenFor(tenants.tenantA, 'provider');

      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          firstName: 'Provider',
          lastName: 'Registered',
          dateOfBirth: '1970-02-02',
        })
        .expect(201);
    });
  });

  describe('AC2: MRNs are tenant-unique and independent across tenants', () => {
    it('never assigns the same MRN twice within one tenant, even under concurrent registrations', async () => {
      const token = tokenFor(tenants.tenantB);

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          request(app.getHttpServer())
            .post('/patients')
            .set('X-Tenant-Id', tenants.tenantB.slug)
            .set('Authorization', `Bearer ${token}`)
            .send({
              firstName: `Concurrent${i}`,
              lastName: 'Patient',
              dateOfBirth: '1990-01-01',
            })
            .expect(201),
        ),
      );

      const mrns = responses.map((r) => (r.body as PatientSummary).mrn);
      expect(new Set(mrns).size).toBe(5);
    });

    it("does not let tenant A's MRN numbering affect tenant B's", async () => {
      // tenantA already has patients registered by earlier tests in this
      // file; tenantB's own numbering (asserted just above) started fresh
      // at MRN-000001 regardless of how many tenantA already had.
      const tokenB = tokenFor(tenants.tenantB);

      const response = await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          firstName: 'Another',
          lastName: 'TenantBPatient',
          dateOfBirth: '1990-01-01',
        })
        .expect(201);

      // 5 concurrent + this one = the 6th patient in tenantB.
      expect((response.body as PatientSummary).mrn).toBe('MRN-000006');
    });
  });

  describe('AC3: GET /patients search', () => {
    beforeAll(async () => {
      const token = tokenFor(tenants.tenantA);
      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Searchable',
          lastName: 'Patient',
          dateOfBirth: '2001-06-15',
        })
        .expect(201);
    });

    it('searches by name, tenant-scoped', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get('/patients')
        .query({ name: 'Searchable' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as PaginatedPatientsResponse;
      expect(body.total).toBe(1);
      expect(body.items[0].lastName).toBe('Patient');
      expect(body.items.every((p) => p.tenantId === tenants.tenantA.id)).toBe(
        true,
      );
    });

    it('searches by MRN', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get('/patients')
        .query({ mrn: 'MRN-000001' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as PaginatedPatientsResponse;
      expect(body.total).toBe(1);
      expect(body.items[0].mrn).toBe('MRN-000001');
    });

    it('searches by date of birth', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get('/patients')
        .query({ dateOfBirth: '2001-06-15' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as PaginatedPatientsResponse;
      expect(body.total).toBe(1);
      expect(body.items[0].firstName).toBe('Searchable');
    });

    it('paginates results', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get('/patients')
        .query({ page: 1, limit: 1 })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as PaginatedPatientsResponse;
      expect(body.page).toBe(1);
      expect(body.limit).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.total).toBeGreaterThan(1);
    });

    it('never returns patients registered under a different tenant', async () => {
      const tokenA = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get('/patients')
        .query({ name: 'Concurrent' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const body = response.body as PaginatedPatientsResponse;
      expect(body.total).toBe(0);
    });

    it('allows a STAFF role to search (READ_PATIENT granted to every role)', async () => {
      const staffToken = tokenFor(tenants.tenantA, 'staff');

      await request(app.getHttpServer())
        .get('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });

  describe('AC4: creating a patient emits a patient.created domain event', () => {
    it('publishes patient.created with the correct shape after a successful registration', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Event',
          lastName: 'Emitter',
          dateOfBirth: '1995-04-04',
        })
        .expect(201);

      const body = response.body as PatientSummary;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishPatientCreated).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishPatientCreated).toHaveBeenCalledWith({
        patientId: body.id,
        tenantId: tenants.tenantA.id,
        createdAt: body.createdAt,
      });
    });

    it('does not publish an event for a rejected (400) registration', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Incomplete' })
        .expect(400);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishPatientCreated).not.toHaveBeenCalled();
    });
  });

  describe('tenant/auth guard composition (shared with every route)', () => {
    it('rejects POST /patients with no Authorization header (401)', async () => {
      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        })
        .expect(401);
    });

    it('rejects POST /patients with no X-Tenant-Id (404)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        })
        .expect(404);
    });

    it('rejects POST /patients for an inactive tenant (403)', async () => {
      const token = tokenFor(tenants.inactiveTenant);

      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.inactiveTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        })
        .expect(403);
    });

    it('rejects a token issued for a DIFFERENT tenant than X-Tenant-Id claims (401)', async () => {
      const tokenForTenantB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenForTenantB}`)
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        })
        .expect(401);
    });

    it('rejects GET /patients for an unknown tenant (404)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .get('/patients')
        .set('X-Tenant-Id', 'no-such-tenant')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
