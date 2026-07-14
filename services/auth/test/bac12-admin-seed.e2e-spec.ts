import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { RegisteredUser } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Independent, black-box contract/integration check for BAC-12's
 * `POST /auth/admin-seed`, written by api-tester as a separate check from
 * the backend-engineer's own e2e suite (`services/tenant/test/
 * onboarding.e2e-spec.ts`, which fakes this HTTP boundary entirely). This
 * spec hits the REAL endpoint, the REAL `InternalServiceGuard`, and a REAL
 * (pg-mem) database -- nothing here is mocked.
 */
describe('BAC-12: POST /auth/admin-seed (internal, api-tester independent check)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  const INTERNAL_KEY = 'api-tester-independent-internal-key';

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-admin-seed-test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
    process.env.REFRESH_TOKEN_TTL_SECONDS = '604800';
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

  it('rejects a request with NO X-Internal-Service-Key header, 401, even with a valid X-Tenant-Id', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/admin-seed')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email: 'no-key@new-clinic.example.com' });

    expect(response.status).toBe(401);
  });

  it('rejects a request with a WRONG X-Internal-Service-Key, 401, even though it is a well-formed request', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/admin-seed')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', 'definitely-the-wrong-key')
      .send({ email: 'wrong-key@new-clinic.example.com' });

    expect(response.status).toBe(401);
  });

  it('rejects a request presenting a normal end-user Bearer token instead of the internal key, 401 (proves this is a separate trust boundary from AccessTokenGuard)', async () => {
    // No bearer token verification is even attempted here on purpose: the
    // route has NO AccessTokenGuard, so presenting one (garbage or not)
    // must not somehow satisfy InternalServiceGuard.
    const response = await request(app.getHttpServer())
      .post('/auth/admin-seed')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', 'Bearer not-a-real-jwt-and-also-irrelevant-here')
      .send({ email: 'bearer-only@new-clinic.example.com' });

    expect(response.status).toBe(401);
  });

  it('seeds a genuine clinic_admin user (not some other role) when the correct internal key is presented', async () => {
    const email = 'admin-seed-verify@tenant-a.example.com';
    const response = await request(app.getHttpServer())
      .post('/auth/admin-seed')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', INTERNAL_KEY)
      .send({ email })
      .expect(201);

    const body = response.body as RegisteredUser;
    expect(body.email).toBe(email);
    expect(body.role).toBe('clinic_admin');
    expect(body).not.toHaveProperty('passwordHash');

    // Independently verify persistence: query the tenant's own schema
    // directly (bypassing the HTTP layer entirely) to confirm the row is
    // real and genuinely has role='clinic_admin', not just that the HTTP
    // response claimed so.
    const rows = await pool.query(
      `SELECT email, role FROM ${tenants.tenantA.schemaName}.users WHERE email = $1`,
      [email],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ email, role: 'clinic_admin' });
  });

  it('returns 409 (not a silent overwrite) when admin-seeding a duplicate email in the same tenant', async () => {
    const email = 'dup-admin-seed@tenant-a.example.com';
    await request(app.getHttpServer())
      .post('/auth/admin-seed')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', INTERNAL_KEY)
      .send({ email })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/admin-seed')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('X-Internal-Service-Key', INTERNAL_KEY)
      .send({ email })
      .expect(409);
  });
});
