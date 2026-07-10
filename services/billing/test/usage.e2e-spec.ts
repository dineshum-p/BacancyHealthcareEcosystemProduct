import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  UsageEventResponse,
  UsageSummaryResponse,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-billing-usage-test-secret';

/**
 * Proves BAC-11's four acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`), the same approach every other service in
 * this repo established: production and `docker-compose.test.yml` both use
 * the real `pg` driver against real Postgres; only `PG_POOL` is swapped
 * here.
 *
 * `services/billing` never issues tokens itself, so tests sign tokens with
 * a plain `JwtService` using the SAME secret this app is configured with --
 * standing in for `services/auth`'s own token issuance, mirroring
 * `services/emr`'s BAC-10 e2e pattern exactly.
 */
describe('Billing usage metering (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
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
  ): string {
    return signToken({ userId: 'user-1', tenantId: tenant.id, role });
  }

  describe('AC1: POST /billing/usage/events', () => {
    it('records a patient.created usage event and returns 201 with the created record', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 'evt-ac1-1',
          tenantId: tenants.tenantA.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(201);

      const body = response.body as UsageEventResponse;
      expect(body.eventId).toBe('evt-ac1-1');
      expect(body.metric).toBe('patient.created');
      expect(body.quantity).toBe(1);
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.id).toEqual(expect.any(String));
    });

    it('records an encounter.created usage event too', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 'evt-ac1-2',
          tenantId: tenants.tenantA.id,
          metric: 'encounter.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(201);
    });

    it('rejects an unknown metric with 400 (closed MeteredMetric catalog)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 'evt-bad-metric',
          tenantId: tenants.tenantA.id,
          metric: 'prescription.filled',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(400);
    });

    it('rejects a body whose tenantId does not match X-Tenant-Id with 403 (cross-tenant write)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 'evt-cross-tenant',
          tenantId: tenants.tenantB.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(403);
    });

    it('every role (including staff) may record usage (AC1: metering does not gate stricter than the underlying action)', async () => {
      const staffToken = tokenFor(tenants.tenantA, 'staff');

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          eventId: 'evt-staff-role',
          tenantId: tenants.tenantA.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(201);
    });
  });

  describe('AC3: idempotency on eventId', () => {
    it('recording the SAME eventId twice does not double-count usage', async () => {
      const token = tokenFor(tenants.tenantA);
      const eventId = 'evt-idempotent-1';

      const first = await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId,
          tenantId: tenants.tenantA.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-02-01T00:00:00.000Z',
        })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId,
          tenantId: tenants.tenantA.id,
          // Deliberately different payload on the "replay" -- must be ignored.
          metric: 'encounter.created',
          quantity: 50,
          occurredAt: '2026-02-15T00:00:00.000Z',
        })
        .expect(201);

      const firstBody = first.body as UsageEventResponse;
      const secondBody = second.body as UsageEventResponse;
      expect(secondBody.id).toBe(firstBody.id);
      expect(secondBody.metric).toBe('patient.created');
      expect(secondBody.quantity).toBe(1);

      const adminToken = tokenFor(tenants.tenantA, 'clinic_admin');
      const summary = await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantA.id, period: '2026-02' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const summaryBody = summary.body as UsageSummaryResponse;
      const patientMetric = summaryBody.metrics.find(
        (m) => m.metric === 'patient.created',
      );
      expect(patientMetric?.quantity).toBe(1);
    });
  });

  describe('AC2/AC4: GET /billing/usage', () => {
    it('returns aggregated totals per metric for the period, flagging one that exceeds the starter plan limit', async () => {
      const token = tokenFor(tenants.tenantA);

      // tenantA is on the "starter" plan (limit: 100 patient.created).
      for (let i = 0; i < 101; i += 1) {
        await request(app.getHttpServer())
          .post('/billing/usage/events')
          .set('X-Tenant-Id', tenants.tenantA.slug)
          .set('Authorization', `Bearer ${token}`)
          .send({
            eventId: `evt-limit-${i}`,
            tenantId: tenants.tenantA.id,
            metric: 'patient.created',
            quantity: 1,
            occurredAt: '2026-03-05T00:00:00.000Z',
          })
          .expect(201);
      }

      const adminToken = tokenFor(tenants.tenantA, 'clinic_admin');
      const response = await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantA.id, period: '2026-03' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as UsageSummaryResponse;
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.period).toBe('2026-03');
      const patientMetric = body.metrics.find(
        (m) => m.metric === 'patient.created',
      );
      expect(patientMetric).toMatchObject({
        quantity: 101,
        limit: 100,
        limitExceeded: true,
      });
      const encounterMetric = body.metrics.find(
        (m) => m.metric === 'encounter.created',
      );
      expect(encounterMetric).toMatchObject({
        quantity: 0,
        limit: 250,
        limitExceeded: false,
      });
    });

    it("resolves a different tenant's plan-specific limit (tenantB is on growth)", async () => {
      const tokenB = tokenFor(tenants.tenantB);
      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          eventId: 'evt-tenant-b-1',
          tenantId: tenants.tenantB.id,
          metric: 'patient.created',
          quantity: 150,
          occurredAt: '2026-04-01T00:00:00.000Z',
        })
        .expect(201);

      const adminTokenB = tokenFor(tenants.tenantB, 'clinic_admin');
      const response = await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantB.id, period: '2026-04' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${adminTokenB}`)
        .expect(200);

      const body = response.body as UsageSummaryResponse;
      const patientMetric = body.metrics.find(
        (m) => m.metric === 'patient.created',
      );
      // growth plan limit is 1000 -- 150 must NOT be flagged as exceeded.
      expect(patientMetric).toMatchObject({
        quantity: 150,
        limit: 1000,
        limitExceeded: false,
      });
    });

    it('AC4/tenant isolation: usage recorded under tenant A never appears in tenant B totals', async () => {
      const tokenA = tokenFor(tenants.tenantA);
      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: 'evt-isolation-a',
          tenantId: tenants.tenantA.id,
          metric: 'encounter.created',
          quantity: 9,
          occurredAt: '2026-05-01T00:00:00.000Z',
        })
        .expect(201);

      const adminTokenB = tokenFor(tenants.tenantB, 'clinic_admin');
      const response = await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantB.id, period: '2026-05' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${adminTokenB}`)
        .expect(200);

      const body = response.body as UsageSummaryResponse;
      const encounterMetric = body.metrics.find(
        (m) => m.metric === 'encounter.created',
      );
      expect(encounterMetric?.quantity).toBe(0);
    });

    it('rejects a query tenantId that does not match X-Tenant-Id with 403 (cross-tenant read)', async () => {
      const adminToken = tokenFor(tenants.tenantA, 'clinic_admin');

      await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantB.id, period: '2026-03' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('rejects a STAFF role from reading usage with 403 (RBAC: READ_USAGE required)', async () => {
      const staffToken = tokenFor(tenants.tenantA, 'staff');

      await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantA.id, period: '2026-03' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('rejects a malformed period with 400', async () => {
      const adminToken = tokenFor(tenants.tenantA, 'clinic_admin');

      await request(app.getHttpServer())
        .get('/billing/usage')
        .query({ tenantId: tenants.tenantA.id, period: '2026/03' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('tenant/auth guard composition (shared with every mutation route)', () => {
    it('rejects POST /billing/usage/events with no Authorization header (401)', async () => {
      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send({
          eventId: 'evt-no-auth',
          tenantId: tenants.tenantA.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(401);
    });

    it('rejects POST /billing/usage/events with no X-Tenant-Id (404)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 'evt-no-tenant',
          tenantId: tenants.tenantA.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(404);
    });

    it('rejects POST /billing/usage/events for an inactive tenant (403)', async () => {
      const token = tokenFor(tenants.inactiveTenant);

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.inactiveTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 'evt-inactive-tenant',
          tenantId: tenants.inactiveTenant.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(403);
    });

    it('rejects a token issued for a DIFFERENT tenant than X-Tenant-Id claims (401)', async () => {
      const tokenForTenantB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .post('/billing/usage/events')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenForTenantB}`)
        .send({
          eventId: 'evt-token-mismatch',
          tenantId: tenants.tenantA.id,
          metric: 'patient.created',
          quantity: 1,
          occurredAt: '2026-07-01T00:00:00.000Z',
        })
        .expect(401);
    });
  });
});
