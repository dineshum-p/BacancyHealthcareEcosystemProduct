import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthTokens, RegisteredUser } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { quoteSchemaIdentifier } from '../src/tenants/schema-identifier.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * BAC-42: proves `POST /auth/patients/register` end-to-end against a real
 * (not mocked) SQL engine -- a genuinely new, distinct registration path from
 * `POST /auth/register` (BAC-5) and from `services/patient`'s BAC-36
 * anonymous self-registration (which never creates a login account at all).
 */
describe('BAC-42: POST /auth/patients/register', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-patient-sign-up-test-secret';
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

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      email: uniqueEmail(),
      password: 'super-secret-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1990-05-12',
      ...overrides,
    };
  }

  it('creates a real, login-capable account with role "patient" (not the staff default) and returns 201 without the password hash', async () => {
    const body = validBody();

    const response = await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(body)
      .expect(201);

    const created = response.body as RegisteredUser;
    expect(created).toMatchObject({ email: body.email, role: 'patient' });
    expect(created).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(created)).not.toContain(body.password);

    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    const row = await pool.query<{
      role: string;
      password_hash: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT role, password_hash, first_name, last_name FROM ${schema}.users WHERE email = $1`,
      [body.email],
    );
    expect(row.rows[0]).toMatchObject({
      role: 'patient',
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    expect(row.rows[0].password_hash.startsWith('$argon2')).toBe(true);
  });

  it("does NOT auto-issue a JWT on success -- matches POST /auth/register's existing (no-auto-login) behaviour; the caller must still call POST /auth/login", async () => {
    const body = validBody();

    const response = await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(body)
      .expect(201);

    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email: body.email, password: body.password })
      .expect(200);
    const tokens = loginResponse.body as AuthTokens;
    expect(typeof tokens.accessToken).toBe('string');
  });

  it("is NOT subject to bootstrap-admin (ownerEmail) promotion -- signing up with the tenant's exact ownerEmail still lands as 'patient', not 'super_admin'", async () => {
    const tenant = tenants.tenantB;
    const response = await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenant.slug)
      .send(validBody({ email: uniqueEmail() }))
      .expect(201);

    expect((response.body as RegisteredUser).role).toBe('patient');
  });

  it('enforces email uniqueness per tenant: a duplicate email returns 409, same as POST /auth/register', async () => {
    const body = validBody();
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(validBody({ email: body.email }))
      .expect(409);
  });

  it('allows the same email to sign up independently in two different tenants (tenant scoping)', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(validBody({ email }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send(validBody({ email }))
      .expect(201);
  });

  it('a patient user registered under tenant A cannot log in against tenant B (multi-tenant isolation)', async () => {
    const body = validBody();
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email: body.email, password: body.password })
      .expect(401);
  });

  it('rejects requests with no X-Tenant-Id with 401 (same TenantGuard convention as every other route)', async () => {
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .send(validBody())
      .expect(401);
  });

  it('rejects requests for an inactive tenant with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.inactiveTenant.slug)
      .send(validBody())
      .expect(401);
  });

  it('rejects a malformed body (missing required fields) with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email: uniqueEmail(), password: 'super-secret-1' })
      .expect(400);
  });

  it('rejects a non-ISO-8601 dateOfBirth with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(validBody({ dateOfBirth: 'not-a-date' }))
      .expect(400);
  });

  it('rejects a password shorter than 8 characters with 400 (same convention as POST /auth/register)', async () => {
    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send(validBody({ password: 'short' }))
      .expect(400);
  });
});
