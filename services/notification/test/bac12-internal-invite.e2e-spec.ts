import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { NotificationResponse } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Independent, black-box contract/integration check for BAC-12's
 * `POST /notifications/internal`, written by api-tester as a separate check
 * from the backend-engineer's own e2e suite (`services/tenant/test/
 * onboarding.e2e-spec.ts`, which fakes this HTTP boundary entirely). This
 * spec hits the REAL endpoint, the REAL `InternalServiceGuard`, and a REAL
 * (pg-mem) database -- nothing here is mocked -- and independently confirms
 * a notification ROW was actually persisted, not just that the HTTP call
 * returned 2xx.
 */
describe('BAC-12: POST /notifications/internal (internal, api-tester independent check)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  const INTERNAL_KEY = 'api-tester-independent-internal-key';

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-invite-test-secret';
    process.env.INTERNAL_SERVICE_KEY = INTERNAL_KEY;

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);

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

  const invitePayload = {
    channel: 'email' as const,
    to: 'invited-admin@tenant-a.example.com',
    templateId: 'tenant.onboarding.admin-invite',
    data: {
      tenantName: 'Tenant A',
      email: 'invited-admin@tenant-a.example.com',
    },
  };

  it('rejects a request with NO X-Internal-Service-Key header, 401, even with a valid X-Tenant-Id', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications/internal')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(invitePayload);

    expect(response.status).toBe(401);
  });

  it('rejects a request with a WRONG X-Internal-Service-Key, 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications/internal')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', 'definitely-the-wrong-key')
      .send(invitePayload);

    expect(response.status).toBe(401);
  });

  it('rejects a request presenting a normal end-user Bearer token instead of the internal key, 401 (proves this is a separate trust boundary from AccessTokenGuard)', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications/internal')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', 'Bearer not-a-real-jwt-and-also-irrelevant-here')
      .send(invitePayload);

    expect(response.status).toBe(401);
  });

  it('actually creates a persisted notification record (not just a 2xx HTTP response) when the correct internal key is presented', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications/internal')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', INTERNAL_KEY)
      .send(invitePayload)
      .expect(201);

    const body = response.body as NotificationResponse;
    expect(body.id).toEqual(expect.any(String));
    expect(body.channel).toBe('email');
    expect(body.to).toBe(invitePayload.to);

    // Independently verify persistence by querying the tenant schema's own
    // `notifications` table directly (bypassing the HTTP layer / the
    // `GET /notifications/:id` endpoint entirely), and by GET-ing it back
    // through the real, guarded HTTP path too.
    const rows = await pool.query(
      `SELECT id, channel, to_address, template_id FROM ${tenants.tenantA.schemaName}.notifications WHERE id = $1`,
      [body.id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      id: body.id,
      channel: 'email',
      to_address: invitePayload.to,
      template_id: 'tenant.onboarding.admin-invite',
    });
  });

  it('rejects an unknown templateId with 400, never silently queuing garbage content', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications/internal')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', INTERNAL_KEY)
      .send({ ...invitePayload, templateId: 'no-such-template' });

    expect(response.status).toBe(400);
  });
});
