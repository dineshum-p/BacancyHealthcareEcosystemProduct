import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { decode } from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  AccessTokenResponse,
  AuthTokens,
} from '@hep/shared-types';

interface ErrorBody {
  message: string;
}
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { quoteSchemaIdentifier } from '../src/tenants/schema-identifier.util';
import { hashRefreshToken } from '../src/auth/refresh-token.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Proves BAC-5's acceptance criteria end-to-end against a real (not mocked)
 * SQL engine: register/login/refresh scoped to a tenant resolved from
 * `X-Tenant-Id`, exactly mirroring how `services/tenant`'s BAC-4 e2e suite
 * proves schema isolation.
 *
 * Runs against `pg-mem` so it executes without a docker daemon; production
 * and `docker-compose.test.yml` both use the real `pg` driver against real
 * Postgres -- only the `PG_POOL` provider is swapped here.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
    process.env.REFRESH_TOKEN_TTL_SECONDS = '604800';

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

  function uniqueEmail(): string {
    return `${randomUUID()}@example.com`;
  }

  it('AC1: registers a user scoped to the tenant, hashed, and returns 201 without the hash', async () => {
    const email = uniqueEmail();
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    expect(response.body).toMatchObject({ email, role: 'member' });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password');
    expect(JSON.stringify(response.body)).not.toContain('super-secret-1');

    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    const row = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM ${schema}.users WHERE email = $1`,
      [email],
    );
    expect(row.rows[0].password_hash).not.toBe('super-secret-1');
    expect(row.rows[0].password_hash.startsWith('$argon2')).toBe(true);
  });

  it('a user registered under tenant A is invisible to tenant B (multi-tenant isolation)', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(401);
  });

  it('AC2 + AC5: logs in with valid credentials and returns access + refresh tokens with the right JWT claims', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(200);

    const body = response.body as AuthTokens;
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.expiresIn).toBe(900);

    const claims = decode(body.accessToken) as AccessTokenPayload;
    expect(claims).toMatchObject({
      tenantId: tenants.tenantA.id,
      role: 'member',
    });
    expect(typeof claims.userId).toBe('string');
  });

  it('AC3: rejects an unknown email and a wrong password with the identical uniform 401', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    const unknownEmailResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email: uniqueEmail(), password: 'super-secret-1' })
      .expect(401);

    const wrongPasswordResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'totally-wrong' })
      .expect(401);

    expect((unknownEmailResponse.body as ErrorBody).message).toEqual(
      (wrongPasswordResponse.body as ErrorBody).message,
    );
  });

  it('AC4: exchanges a valid refresh token for a new access token', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(200);
    const { refreshToken } = loginResponse.body as AuthTokens;

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ refreshToken })
      .expect(200);

    const refreshBody = refreshResponse.body as AccessTokenResponse;
    expect(typeof refreshBody.accessToken).toBe('string');
    expect(refreshBody.expiresIn).toBe(900);
  });

  it('AC4: rejects a revoked refresh token with 401', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(200);
    const { refreshToken } = loginResponse.body as AuthTokens;

    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    await pool.query(
      `UPDATE ${schema}.refresh_tokens SET revoked = true WHERE token_hash = $1`,
      [hashRefreshToken(refreshToken)],
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ refreshToken })
      .expect(401);
  });

  it('AC4: rejects an expired refresh token with 401', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(200);
    const { refreshToken } = loginResponse.body as AuthTokens;

    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    await pool.query(
      `UPDATE ${schema}.refresh_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashRefreshToken(refreshToken)],
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ refreshToken })
      .expect(401);
  });

  it('rejects a completely unknown refresh token with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
  });

  it('rejects requests with no X-Tenant-Id with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'someone@example.com', password: 'whatever' })
      .expect(401);
  });

  it('rejects requests for an inactive tenant with 401 (uniform, not 403)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.inactiveTenant.slug)
      .send({ email: uniqueEmail(), password: 'super-secret-1' })
      .expect(401);
  });

  it('rejects a duplicate registration within the same tenant with 409', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'another-password' })
      .expect(409);
  });

  it('allows the same email to register independently in two different tenants', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: 'a-different-password' })
      .expect(201);
  });
});
