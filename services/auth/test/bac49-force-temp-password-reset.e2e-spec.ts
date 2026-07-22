import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthTokens,
  CreateProviderAccountResponse,
  LoginResult,
  PasswordResetRequiredChallenge,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { verifyPassword } from '../src/auth/password-hasher.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * BAC-49: proves the forced-reset flow end-to-end against a real (not
 * mocked) SQL engine -- login for a BAC-48 admin-provisioned account
 * (`mustResetPassword: true`) withholds a full token pair, and
 * `POST /auth/reset-temporary-password` completes the reset and unlocks
 * normal login afterward. Mirrors `test/bac48-create-provider-account.e2e-spec.ts`'s
 * conventions for standing up a provider account via a super_admin caller.
 */
describe('BAC-49: forced temporary-password reset', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  const providerBody = {
    firstName: 'Grace',
    lastName: 'Hopper',
    dateOfBirth: '1980-01-15',
    gender: 'female',
    email: '',
    phone: '+1-555-0100',
    address: '1 Infinite Loop',
    role: 'provider',
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-bac49-secret';
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

  async function superAdminAccessToken(
    tenantSlug: string,
    ownerEmail: string,
  ): Promise<string> {
    const password = 'super-secret-1';
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenantSlug)
      .send({ email: ownerEmail, password })
      .catch(() => undefined);
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenantSlug)
      .send({ email: ownerEmail, password })
      .expect(200);
    return (loginResponse.body as AuthTokens).accessToken;
  }

  /** Creates a fresh BAC-48 provider account (mustResetPassword: true) and returns its credentials. */
  async function createProviderAccount(
    tenantSlug: string,
    superAdminToken: string,
  ): Promise<{ email: string; temporaryPassword: string }> {
    const email = uniqueEmail();
    const response = await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenantSlug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...providerBody, email })
      .expect(201);
    const body = response.body as CreateProviderAccountResponse;
    return { email, temporaryPassword: body.temporaryPassword };
  }

  it('AC1: login with a valid temporary password signals passwordResetRequired and withholds a full token pair', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );
    const { email, temporaryPassword } = await createProviderAccount(
      tenants.tenantA.slug,
      superAdminToken,
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: temporaryPassword })
      .expect(200);

    const body = loginResponse.body as PasswordResetRequiredChallenge;
    expect(body.passwordResetRequired).toBe(true);
    expect(typeof body.accessToken).toBe('string');
    expect(body).not.toHaveProperty('refreshToken');
  });

  it('AC2/AC4: reset-temporary-password rejects without a valid access token, then succeeds and unlocks normal login', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantB.slug,
      tenants.tenantB.ownerEmail as string,
    );
    const { email, temporaryPassword } = await createProviderAccount(
      tenants.tenantB.slug,
      superAdminToken,
    );

    // AC4: no Bearer token at all -> 401, mirroring AccessTokenGuard's
    // existing behaviour on every other authenticated route.
    await request(app.getHttpServer())
      .post('/auth/reset-temporary-password')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({
        currentPassword: temporaryPassword,
        newPassword: 'brand-new-real-password-1',
      })
      .expect(401);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: temporaryPassword })
      .expect(200);
    const { accessToken: restrictedAccessToken } =
      loginResponse.body as PasswordResetRequiredChallenge;

    const newPassword = 'brand-new-real-password-1';
    const resetResponse = await request(app.getHttpServer())
      .post('/auth/reset-temporary-password')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .set('Authorization', `Bearer ${restrictedAccessToken}`)
      .send({ currentPassword: temporaryPassword, newPassword })
      .expect(200);

    const tokens = resetResponse.body as AuthTokens;
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');

    // Persistence: the stored hash changed and must_reset_password flipped.
    const rows = await pool.query<{
      must_reset_password: boolean;
      password_hash: string;
    }>(
      `SELECT must_reset_password, password_hash FROM ${tenants.tenantB.schemaName}.users WHERE email = $1`,
      [email],
    );
    expect(rows.rows[0].must_reset_password).toBe(false);
    await expect(
      verifyPassword(rows.rows[0].password_hash, newPassword),
    ).resolves.toBe(true);

    // AC3: subsequent logins with the OLD temporary password no longer work...
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: temporaryPassword })
      .expect(401);

    // ...and logging in with the NEW password proceeds normally (a full,
    // unchanged AuthTokens shape -- no regression, AC3).
    const normalLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: newPassword })
      .expect(200);
    const normalLoginBody = normalLogin.body as LoginResult;
    expect(normalLoginBody).not.toHaveProperty('passwordResetRequired');
    expect(normalLoginBody).not.toHaveProperty('mfaRequired');
    expect(typeof (normalLoginBody as AuthTokens).refreshToken).toBe('string');
  });

  it('rejects an incorrect current password on reset with 401', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );
    const { email, temporaryPassword } = await createProviderAccount(
      tenants.tenantA.slug,
      superAdminToken,
    );
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: temporaryPassword })
      .expect(200);
    const { accessToken } =
      loginResponse.body as PasswordResetRequiredChallenge;

    await request(app.getHttpServer())
      .post('/auth/reset-temporary-password')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'wrong-password',
        newPassword: 'brand-new-real-password-1',
      })
      .expect(401);
  });

  it('rejects a new password that fails the shared password policy (400)', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );
    const { email, temporaryPassword } = await createProviderAccount(
      tenants.tenantA.slug,
      superAdminToken,
    );
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: temporaryPassword })
      .expect(200);
    const { accessToken } =
      loginResponse.body as PasswordResetRequiredChallenge;

    await request(app.getHttpServer())
      .post('/auth/reset-temporary-password')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: temporaryPassword, newPassword: 'short' })
      .expect(400);
  });

  it('SECURITY: the passwordResetRequired token is rejected on an unrelated AccessTokenGuard route (GET /auth/roles), not just accepted on the reset endpoint', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantB.slug,
      tenants.tenantB.ownerEmail as string,
    );
    const { email, temporaryPassword } = await createProviderAccount(
      tenants.tenantB.slug,
      superAdminToken,
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: temporaryPassword })
      .expect(200);
    const { accessToken: restrictedAccessToken } =
      loginResponse.body as PasswordResetRequiredChallenge;

    // Must NOT be usable as a general Bearer credential against any other
    // AccessTokenGuard-protected route -- only against
    // POST /auth/reset-temporary-password.
    await request(app.getHttpServer())
      .get('/auth/roles')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .set('Authorization', `Bearer ${restrictedAccessToken}`)
      .expect(401);
  });

  it('AC3: an ordinary (non-mustResetPassword) account logs in unchanged, with a full token pair', async () => {
    const email = uniqueEmail();
    const password = 'super-secret-1';
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);

    const body = loginResponse.body as AuthTokens;
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body).not.toHaveProperty('passwordResetRequired');
  });
});
