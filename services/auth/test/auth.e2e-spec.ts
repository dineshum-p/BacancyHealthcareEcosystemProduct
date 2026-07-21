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
  RegisteredUser,
  RoleDefinition,
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
import {
  seedTestTenants,
  SeededTenants,
  createAdditionalTenant,
} from './support/tenant-fixtures';

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
    // BAC-7: registering with tenant A's exact `ownerEmail` (set at
    // tenant-creation time, see `test/support/tenant-fixtures.ts`) is what
    // triggers bootstrap-admin promotion now -- NOT "being first" -- so this
    // test uses it deliberately. See the dedicated "BAC-7: role-based access
    // control" describe block below for the non-owner default and the rest
    // of the RBAC surface.
    const email = tenants.tenantA.ownerEmail as string;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    expect(response.body).toMatchObject({ email, role: 'super_admin' });
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
      // BAC-7: this `uniqueEmail()` is NOT tenant A's `ownerEmail`, so this
      // gets the ordinary default role, `staff`, regardless of registration
      // order.
      role: 'staff',
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

  /**
   * BAC-7: RBAC. Uses `tenants.rbacTenant` (a tenant used ONLY by this
   * describe block, per `test/support/tenant-fixtures.ts`'s doc comment) so
   * the bootstrap-admin (`ownerEmail`) case is deterministic and doesn't
   * depend on execution order relative to `tenantA`/`tenantB`'s other uses
   * above.
   */
  describe('BAC-7: role-based access control', () => {
    let rootUserId: string;
    let rootAccessToken: string;

    async function registerAndLogin(
      tenantSlug: string,
      email: string = uniqueEmail(),
    ): Promise<{
      userId: string;
      email: string;
      accessToken: string;
    }> {
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

      return { userId, email, accessToken };
    }

    beforeAll(async () => {
      // Registering with `rbacTenant`'s exact `ownerEmail` (set at
      // tenant-creation time) -- NOT merely being first -- is what makes
      // bootstrap-admin resolution (BAC-7) promote this user to
      // `super_admin`.
      const bootstrap = await registerAndLogin(
        tenants.rbacTenant.slug,
        tenants.rbacTenant.ownerEmail as string,
      );
      rootUserId = bootstrap.userId;
      rootAccessToken = bootstrap.accessToken;
    });

    it("AC1 (bootstrap): registering with the tenant's exact ownerEmail is automatically super_admin", () => {
      const claims = decode(rootAccessToken) as AccessTokenPayload;
      expect(claims.role).toBe('super_admin');
    });

    it('AC1 (bootstrap, case-insensitive): ownerEmail matching is case-insensitive', async () => {
      // A fresh tenant so this owner-email can register exactly once
      // without colliding with `rbacTenant`'s already-registered owner.
      const ownerEmail = 'Owner-Case@Example.com';
      const tenant = await createAdditionalTenant(pool, {
        slug: `rbac-case-${randomUUID()}`,
        ownerEmail,
      });

      const { accessToken } = await registerAndLogin(
        tenant.slug,
        ownerEmail.toUpperCase(),
      );
      const claims = decode(accessToken) as AccessTokenPayload;
      expect(claims.role).toBe('super_admin');
    });

    it('AC1 (default): a subsequent registration in the same tenant defaults to staff, not super_admin', async () => {
      const { accessToken } = await registerAndLogin(tenants.rbacTenant.slug);
      const claims = decode(accessToken) as AccessTokenPayload;
      expect(claims.role).toBe('staff');
    });

    it('AC1 (exploit closed): the FIRST-EVER registration for a brand-new tenant is STILL staff when it is not the ownerEmail', async () => {
      const tenant = await createAdditionalTenant(pool, {
        slug: `rbac-fresh-${randomUUID()}`,
        ownerEmail: 'real-owner@example.com',
      });

      // An attacker who knows/guesses the tenant's slug but not its
      // ownerEmail, registering FIRST, must still land as staff -- this is
      // the exact exploit BAC-7 closes (previously: whoever registers first
      // becomes the tenant's sole super_admin).
      const { accessToken } = await registerAndLogin(
        tenant.slug,
        'attacker@example.com',
      );
      const claims = decode(accessToken) as AccessTokenPayload;
      expect(claims.role).toBe('staff');
    });

    it('AC1 (race-proof): two concurrent registrations with different non-owner emails both land as staff', async () => {
      const tenant = await createAdditionalTenant(pool, {
        slug: `rbac-race-${randomUUID()}`,
        ownerEmail: 'real-owner@example.com',
      });

      const [first, second] = await Promise.all([
        registerAndLogin(tenant.slug, 'racer-one@example.com'),
        registerAndLogin(tenant.slug, 'racer-two@example.com'),
      ]);

      expect((decode(first.accessToken) as AccessTokenPayload).role).toBe(
        'staff',
      );
      expect((decode(second.accessToken) as AccessTokenPayload).role).toBe(
        'staff',
      );
    });

    it('AC1: GET /auth/roles returns the five seeded roles with their permission sets', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/roles')
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .expect(200);

      const roles = response.body as RoleDefinition[];
      expect(roles.map((r) => r.role).sort()).toEqual([
        'clinic_admin',
        'patient',
        'provider',
        'staff',
        'super_admin',
      ]);
      const superAdmin = roles.find((r) => r.role === 'super_admin');
      expect(superAdmin?.permissions).toEqual(
        expect.arrayContaining(['manage_user_roles', 'view_users']),
      );
      const staff = roles.find((r) => r.role === 'staff');
      expect(staff?.permissions).not.toContain('manage_user_roles');
      // BAC-41: patient is default-deny -- an empty permission set, not
      // silent inheritance of any staff-side permission.
      const patient = roles.find((r) => r.role === 'patient');
      expect(patient?.permissions).toEqual([]);
    });

    it('GET /auth/roles requires authentication (401 with no Bearer token)', async () => {
      await request(app.getHttpServer())
        .get('/auth/roles')
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .expect(401);
    });

    it('AC2: a role lacking MANAGE_USER_ROLES gets 403 (not 401) attempting role assignment', async () => {
      const staffUser = await registerAndLogin(tenants.rbacTenant.slug);
      const anotherUser = await registerAndLogin(tenants.rbacTenant.slug);

      await request(app.getHttpServer())
        .patch(`/auth/users/${anotherUser.userId}/role`)
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .set('Authorization', `Bearer ${staffUser.accessToken}`)
        .send({ role: 'provider' })
        .expect(403);
    });

    it("AC3 + AC4: super_admin can reassign a role (2xx), and the NEW role appears on the next login's JWT", async () => {
      const target = await registerAndLogin(tenants.rbacTenant.slug);
      // Confirm the pre-change token still carries the OLD role -- proving
      // this is about the NEXT issued token, not retroactive invalidation
      // (see `AuthService.updateUserRole`'s doc comment).
      const preChangeClaims = decode(target.accessToken) as AccessTokenPayload;
      expect(preChangeClaims.role).toBe('staff');

      const patchResponse = await request(app.getHttpServer())
        .patch(`/auth/users/${target.userId}/role`)
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({ role: 'clinic_admin' })
        .expect(200);
      expect((patchResponse.body as RegisteredUser).role).toBe('clinic_admin');

      // The OLD access token is untouched -- decoding it again still shows
      // the OLD role (no access-token revocation infra exists; see
      // `AuthService.updateUserRole`'s doc comment).
      const staleClaims = decode(target.accessToken) as AccessTokenPayload;
      expect(staleClaims.role).toBe('staff');

      // A FRESH login for the same user now carries the NEW role (AC4).
      const freshLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .send({ email: target.email, password: 'super-secret-1' })
        .expect(200);
      const freshClaims = decode(
        (freshLogin.body as AuthTokens).accessToken,
      ) as AccessTokenPayload;
      expect(freshClaims.role).toBe('clinic_admin');
    });

    it('rejects an unknown/invalid role value with 400', async () => {
      const target = await registerAndLogin(tenants.rbacTenant.slug);

      await request(app.getHttpServer())
        .patch(`/auth/users/${target.userId}/role`)
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({ role: 'wizard' })
        .expect(400);
    });

    it('rejects assigning a role to a user in a DIFFERENT tenant with 404 (tenant isolation)', async () => {
      const otherTenantUser = await registerAndLogin(tenants.tenantB.slug);

      await request(app.getHttpServer())
        .patch(`/auth/users/${otherTenantUser.userId}/role`)
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({ role: 'clinic_admin' })
        .expect(404);
    });

    it("rejects an unknown user id within the caller's own tenant with 404", async () => {
      await request(app.getHttpServer())
        .patch(`/auth/users/${randomUUID()}/role`)
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({ role: 'clinic_admin' })
        .expect(404);
    });

    it('requires authentication to attempt role assignment (401 with no Bearer token)', async () => {
      await request(app.getHttpServer())
        .patch(`/auth/users/${rootUserId}/role`)
        .set('X-Tenant-Id', tenants.rbacTenant.slug)
        .send({ role: 'staff' })
        .expect(401);
    });
  });
});
