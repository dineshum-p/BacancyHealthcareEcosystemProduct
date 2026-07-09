import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { authenticator } from 'otplib';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthTokens,
  LoginResult,
  MfaActivation,
  MfaChallenge,
  MfaEnrollment,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { quoteSchemaIdentifier } from '../src/tenants/schema-identifier.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Proves BAC-6's acceptance criteria end-to-end: enroll -> verify/activate
 * (+ recovery codes) -> login challenge -> login-verify, against a real
 * (not mocked) SQL engine (`pg-mem`), mirroring `test/auth.e2e-spec.ts`'s
 * approach for BAC-5.
 */
describe('MFA (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-test-secret';
    process.env.MFA_ENCRYPTION_KEY = 'e2e-test-mfa-key';
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

  /** Registers + logs in a fresh user in tenant A, returning credentials + access token. */
  async function registerAndLogin(): Promise<{
    userId: string;
    email: string;
    password: string;
    accessToken: string;
  }> {
    const email = uniqueEmail();
    const password = 'super-secret-1';
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(201);
    const userId = (registerResponse.body as { id: string }).id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);

    const { accessToken } = loginResponse.body as AuthTokens;
    return { userId, email, password, accessToken };
  }

  /** Enrolls + activates MFA for the given access token, returning the raw secret + recovery codes. */
  async function enrollAndActivateMfa(accessToken: string): Promise<{
    secret: string;
    recoveryCodes: string[];
  }> {
    const enrollResponse = await request(app.getHttpServer())
      .post('/auth/mfa/enroll')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);
    const { secret } = enrollResponse.body as MfaEnrollment;

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/mfa/verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totpCode: authenticator.generate(secret) })
      .expect(200);
    const { recoveryCodes } = verifyResponse.body as MfaActivation;

    return { secret, recoveryCodes };
  }

  it('AC1: enroll returns a base32 secret + otpauth:// URI and does not activate MFA yet', async () => {
    const { accessToken, email } = await registerAndLogin();

    const response = await request(app.getHttpServer())
      .post('/auth/mfa/enroll')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    const body = response.body as MfaEnrollment;
    expect(body.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(body.otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
    expect(body.otpauthUrl).toContain(encodeURIComponent(email));

    // Not yet enforced: logging in again still returns tokens directly.
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(200);
    expect(loginResponse.body).toHaveProperty('accessToken');
    expect(loginResponse.body).not.toHaveProperty('mfaRequired');
  });

  it('AC1: enroll requires a valid Bearer access token', async () => {
    await request(app.getHttpServer())
      .post('/auth/mfa/enroll')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({})
      .expect(401);
  });

  it('AC2: verify with a valid code activates MFA and returns recovery codes exactly once', async () => {
    const { userId, email, accessToken } = await registerAndLogin();
    const enrollResponse = await request(app.getHttpServer())
      .post('/auth/mfa/enroll')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);
    const { secret } = enrollResponse.body as MfaEnrollment;

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/mfa/verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totpCode: authenticator.generate(secret) })
      .expect(200);

    const { recoveryCodes } = verifyResponse.body as MfaActivation;
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);

    // The raw secret is stored encrypted, never in plaintext. Scope every
    // query to THIS test's user -- the pool/schema is shared across the
    // whole describe block, so other tests' users/codes also live in it.
    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    const row = await pool.query<{
      mfa_status: string;
      mfa_secret_encrypted: string;
    }>(
      `SELECT mfa_status, mfa_secret_encrypted FROM ${schema}.users WHERE email = $1`,
      [email],
    );
    expect(row.rows[0].mfa_status).toBe('active');
    expect(row.rows[0].mfa_secret_encrypted).not.toBe(secret);
    expect(row.rows[0].mfa_secret_encrypted).not.toContain(secret);

    // The recovery codes are never retrievable again -- only their hashes exist.
    const recoveryRows = await pool.query<{ code_hash: string }>(
      `SELECT code_hash FROM ${schema}.mfa_recovery_codes WHERE user_id = $1`,
      [userId],
    );
    expect(recoveryRows.rows.length).toBe(10);
    for (const raw of recoveryCodes) {
      expect(recoveryRows.rows.map((r) => r.code_hash)).not.toContain(raw);
    }
  });

  it('AC2: an invalid code during enrollment returns 401 and does not activate MFA', async () => {
    const { accessToken, email } = await registerAndLogin();
    await request(app.getHttpServer())
      .post('/auth/mfa/enroll')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/mfa/verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totpCode: '000000' })
      .expect(401);

    // MFA never activated -- login still returns tokens directly.
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password: 'super-secret-1' })
      .expect(200);
    expect(loginResponse.body).toHaveProperty('accessToken');
  });

  it('AC2: verifying with no pending enrollment returns 409, not 401', async () => {
    const { accessToken } = await registerAndLogin();

    await request(app.getHttpServer())
      .post('/auth/mfa/verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totpCode: '123456' })
      .expect(409);
  });

  it('AC3: login with valid credentials returns an mfa_required challenge, not tokens, once MFA is active', async () => {
    const { email, password, accessToken } = await registerAndLogin();
    await enrollAndActivateMfa(accessToken);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);

    const body = loginResponse.body as LoginResult;
    expect(body).toMatchObject({ mfaRequired: true });
    expect(typeof (body as MfaChallenge).mfaChallengeToken).toBe('string');
    expect(body).not.toHaveProperty('accessToken');
    expect(body).not.toHaveProperty('refreshToken');
  });

  it('AC3: the mfaChallengeToken cannot be used as a Bearer access token', async () => {
    const { email, password, accessToken } = await registerAndLogin();
    await enrollAndActivateMfa(accessToken);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);
    const { mfaChallengeToken } = loginResponse.body as MfaChallenge;

    await request(app.getHttpServer())
      .post('/auth/mfa/enroll')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${mfaChallengeToken}`)
      .send({})
      .expect(401);
  });

  it('AC3 + AC4: mfa/login-verify exchanges a valid challenge + fresh code for real tokens', async () => {
    const { email, password, accessToken } = await registerAndLogin();
    const { secret } = await enrollAndActivateMfa(accessToken);

    // Reset the replay floor directly (bypassing the API) so this test's
    // assertion is independent of how much wall-clock time elapsed between
    // activation (which already consumed the current 30s step) and this
    // call -- otherwise a fast test run could legitimately hit the same
    // step twice and get rejected as a (correctly-detected) reuse, which is
    // exactly what the NEXT test asserts on purpose.
    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    await pool.query(
      `UPDATE ${schema}.users SET mfa_last_used_step = NULL WHERE email = $1`,
      [email],
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);
    const { mfaChallengeToken } = loginResponse.body as MfaChallenge;

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/mfa/login-verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ mfaChallengeToken, totpCode: authenticator.generate(secret) })
      .expect(200);

    const tokens = verifyResponse.body as AuthTokens;
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });

  it('AC4: a reused TOTP code is rejected with 401 and issues no tokens', async () => {
    const { email, password, accessToken } = await registerAndLogin();
    const { secret } = await enrollAndActivateMfa(accessToken);

    const schema = quoteSchemaIdentifier(tenants.tenantA.schemaName);
    await pool.query(
      `UPDATE ${schema}.users SET mfa_last_used_step = NULL WHERE email = $1`,
      [email],
    );

    const firstLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);
    const { mfaChallengeToken: firstChallenge } =
      firstLogin.body as MfaChallenge;
    const code = authenticator.generate(secret);

    await request(app.getHttpServer())
      .post('/auth/mfa/login-verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ mfaChallengeToken: firstChallenge, totpCode: code })
      .expect(200);

    // Reusing the SAME code again (even via a brand-new challenge token
    // from a second login attempt) must fail -- either because the step
    // moved on and the code no longer validates, or because it's the exact
    // step already consumed. Either way: 401, no tokens.
    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);
    const { mfaChallengeToken: secondChallenge } =
      secondLogin.body as MfaChallenge;

    await request(app.getHttpServer())
      .post('/auth/mfa/login-verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ mfaChallengeToken: secondChallenge, totpCode: code })
      .expect(401);
  });

  it('AC4: an invalid TOTP code at login returns 401 and issues no tokens', async () => {
    const { email, password, accessToken } = await registerAndLogin();
    await enrollAndActivateMfa(accessToken);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);
    const { mfaChallengeToken } = loginResponse.body as MfaChallenge;

    await request(app.getHttpServer())
      .post('/auth/mfa/login-verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ mfaChallengeToken, totpCode: '000000' })
      .expect(401);
  });

  it('rejects a garbage/expired mfaChallengeToken with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/mfa/login-verify')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ mfaChallengeToken: 'not-a-real-token', totpCode: '123456' })
      .expect(401);
  });

  it('a challenge token minted for tenant A is rejected under tenant B', async () => {
    const { email, password, accessToken } = await registerAndLogin();
    await enrollAndActivateMfa(accessToken);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ email, password })
      .expect(200);
    const { mfaChallengeToken } = loginResponse.body as MfaChallenge;

    await request(app.getHttpServer())
      .post('/auth/mfa/login-verify')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .send({ mfaChallengeToken, totpCode: '123456' })
      .expect(401);
  });
});
