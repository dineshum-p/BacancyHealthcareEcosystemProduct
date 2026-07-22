import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthTokens,
  CreateProviderAccountResponse,
  RegisteredUser,
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
 * BAC-48: proves `POST /auth/users` end-to-end against a real (not mocked)
 * SQL engine -- a clinic_admin/super_admin creating a new `provider`
 * (doctor) login account in one step, with a system-generated temporary
 * password, mirroring `test/auth.e2e-spec.ts`'s BAC-7 RBAC describe block's
 * conventions for standing up callers of a given role.
 */
describe('BAC-48: POST /auth/users', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  const validBody = {
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
    process.env.JWT_ACCESS_SECRET = 'e2e-create-provider-account-secret';
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

  /**
   * Registers + logs in a plain `staff` user (the default registration
   * role, see `AuthService.register`) -- callers that need `clinic_admin`
   * promote the returned `userId` via `promoteToClinicAdmin` afterwards.
   */
  async function registerStaffUser(tenantSlug: string): Promise<{
    userId: string;
    email: string;
    password: string;
    accessToken: string;
  }> {
    const email = uniqueEmail();
    const password = 'super-secret-1';
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenantSlug)
      .send({ email, password })
      .expect(201);
    const { id: userId } = registerResponse.body as RegisteredUser;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenantSlug)
      .send({ email, password })
      .expect(200);
    const { accessToken } = loginResponse.body as AuthTokens;
    return { userId, email, password, accessToken };
  }

  /** Logs in again for a fresh access token -- needed after a role change (BAC-7: the NEXT issued token carries the new role, not the old one). */
  async function login(
    tenantSlug: string,
    email: string,
    password: string,
  ): Promise<string> {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenantSlug)
      .send({ email, password })
      .expect(200);
    return (loginResponse.body as AuthTokens).accessToken;
  }

  /** Registers with the tenant's exact ownerEmail (BAC-7 bootstrap) so the resulting caller is super_admin. */
  async function superAdminAccessToken(tenantSlug: string, ownerEmail: string) {
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

  async function promoteToClinicAdmin(
    tenantSlug: string,
    superAdminToken: string,
    userId: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .patch(`/auth/users/${userId}/role`)
      .set('X-Tenant-Id', tenantSlug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ role: 'clinic_admin' })
      .expect(200);
  }

  it('rejects with 401 when no access token is presented', async () => {
    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ ...validBody, email: uniqueEmail() })
      .expect(401);
  });

  it('AC2: rejects a staff caller with 403 (not 401) -- authenticated but not authorized', async () => {
    const staffUser = await registerStaffUser(tenants.tenantA.slug);

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${staffUser.accessToken}`)
      .send({ ...validBody, email: uniqueEmail() })
      .expect(403);
  });

  it('AC2: rejects a provider caller with 403', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );
    const created = await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ ...validBody, email: uniqueEmail() })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(201);
    const providerBody = created.body as CreateProviderAccountResponse;

    // BAC-48's account is provisioned with `mustResetPassword: true`
    // (BAC-49), so its first login returns a `PasswordResetRequiredChallenge`
    // -- a narrowly-scoped token that only
    // `POST /auth/reset-temporary-password` accepts (BAC-49's fix), NOT a
    // normal, fully-usable access token. Complete that reset first to get a
    // real, `AccessTokenGuard`-verifiable `provider` token before exercising
    // this (unrelated) `PermissionsGuard` 403 check.
    const providerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({
        email: providerBody.email,
        password: providerBody.temporaryPassword,
      })
      .expect(200);
    const restrictedToken = (providerLogin.body as { accessToken: string })
      .accessToken;

    const resetResponse = await request(app.getHttpServer())
      .post('/auth/reset-temporary-password')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({
        currentPassword: providerBody.temporaryPassword,
        newPassword: 'brand-new-real-password-1',
      })
      .expect(200);
    const providerToken = (resetResponse.body as AuthTokens).accessToken;

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ ...validBody, email: uniqueEmail() })
      .expect(403);
  });

  it('AC1/AC5: a clinic_admin creates a provider account with a returned-once temporary password, mustResetPassword true', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantB.slug,
      tenants.tenantB.ownerEmail as string,
    );
    const staffUser = await registerStaffUser(tenants.tenantB.slug);
    await promoteToClinicAdmin(
      tenants.tenantB.slug,
      superAdminToken,
      staffUser.userId,
    );
    const clinicAdminToken = await login(
      tenants.tenantB.slug,
      staffUser.email,
      staffUser.password,
    );

    const email = uniqueEmail();
    const response = await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .set('Authorization', `Bearer ${clinicAdminToken}`)
      .send({ ...validBody, email })
      .expect(201);

    const body = response.body as CreateProviderAccountResponse;
    expect(body).toMatchObject({
      email,
      role: 'provider',
      firstName: 'Grace',
      lastName: 'Hopper',
      mustResetPassword: true,
    });
    expect(typeof body.temporaryPassword).toBe('string');
    expect(body.temporaryPassword.length).toBeGreaterThanOrEqual(32);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).toContain(body.temporaryPassword);

    // Independently verify persistence + hashing directly against the DB.
    const rows = await pool.query<{
      email: string;
      role: string;
      password_hash: string;
      must_reset_password: boolean;
      gender: string;
      phone: string;
      address: string;
    }>(
      `SELECT email, role, password_hash, must_reset_password, gender, phone, address FROM ${tenants.tenantB.schemaName}.users WHERE email = $1`,
      [email],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      email,
      role: 'provider',
      must_reset_password: true,
      gender: 'female',
      phone: '+1-555-0100',
      address: '1 Infinite Loop',
    });
    expect(rows.rows[0].password_hash.startsWith('$argon2')).toBe(true);
    await expect(
      verifyPassword(rows.rows[0].password_hash, body.temporaryPassword),
    ).resolves.toBe(true);

    // The doctor can log in with the returned temporary password.
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ email, password: body.temporaryPassword })
      .expect(200);
  });

  it('a super_admin may also create a provider account directly', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...validBody, email: uniqueEmail() })
      .expect(201);
  });

  it('AC3: rejects a role other than provider in the body with 400 (not a general "create any role" door)', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...validBody, email: uniqueEmail(), role: 'clinic_admin' })
      .expect(400);
  });

  it('AC3: rejects a missing/garbage role value with 400', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...validBody, email: uniqueEmail(), role: 'not-a-real-role' })
      .expect(400);
  });

  it('AC4: returns 409 (not a silent overwrite) for a duplicate email within the same tenant', async () => {
    const superAdminToken = await superAdminAccessToken(
      tenants.tenantA.slug,
      tenants.tenantA.ownerEmail as string,
    );
    const email = uniqueEmail();

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...validBody, email })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/users')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...validBody, email })
      .expect(409);
  });
});
