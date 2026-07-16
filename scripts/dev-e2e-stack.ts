import { randomUUID } from 'node:crypto';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { Pool } from 'pg';
import type { AccessTokenPayload } from '@hep/shared-types';

import {
  createInMemoryPool,
  createTenantsTable,
} from '../services/tenant/test/support/create-in-memory-pool';
import { AppModule as TenantAppModule } from '../services/tenant/src/app.module';
import { PG_POOL as TENANT_PG_POOL } from '../services/tenant/src/database/database.tokens';
import { getCorsConfig } from '../services/tenant/src/config/cors.config';
import { getCorsConfig as getAuthCorsConfig } from '../services/auth/src/config/cors.config';
import { AppModule as AuthAppModule } from '../services/auth/src/app.module';
import { PG_POOL as AUTH_PG_POOL } from '../services/auth/src/database/database.tokens';
import { AppModule as NotificationAppModule } from '../services/notification/src/app.module';
import { PG_POOL as NOTIFICATION_PG_POOL } from '../services/notification/src/database/database.tokens';
import { generateTotpCode } from '../services/auth/test/support/dev-totp';

/**
 * Dev-only, throwaway harness (NOT shipped/built/CI'd) that boots real
 * listening instances of services/tenant (:3001), services/auth (:3002), and
 * services/notification (:3004) -- matching apps/web's own port assignment
 * scheme (apps/web owns :3000; see scripts/start-all-local.sh) so this
 * harness never collides with a live `next dev` -- sharing ONE in-memory
 * (pg-mem) Postgres pool so `apps/web` can be pointed at real, live backends
 * for browser E2E in a sandbox with no Docker/Postgres available (see the
 * BAC-12 pipeline session notes). All three point at the SAME pool object,
 * mirroring the "same Postgres cluster" assumption every service's own
 * .env.example documents for a real deployment.
 *
 * Uses `@nestjs/testing`'s `Test.createTestingModule(...).overrideProvider`
 * -- the exact mechanism every service's own e2e-spec already uses to swap
 * in pg-mem -- just calling `.listen(port)` on the resulting app instead of
 * driving it with supertest.
 *
 * Usage: npx ts-node --project services/tenant/tsconfig.json --transpile-only scripts/dev-e2e-stack.ts
 */

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.AUTH_SERVICE_URL = 'http://localhost:3002';
process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3004';

async function bootTenant(pool: Pool): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [TenantAppModule] })
    .overrideProvider(TENANT_PG_POOL)
    .useValue(pool)
    .compile();
  const app = moduleRef.createNestApplication();
  app.enableCors(getCorsConfig());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(3001);
  return app;
}

async function bootAuth(pool: Pool): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AuthAppModule] })
    .overrideProvider(AUTH_PG_POOL)
    .useValue(pool)
    .compile();
  const app = moduleRef.createNestApplication();
  app.enableCors(getAuthCorsConfig());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(3002);
  return app;
}

async function bootNotification(pool: Pool): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [NotificationAppModule] })
    .overrideProvider(NOTIFICATION_PG_POOL)
    .useValue(pool)
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(3004);
  return app;
}

interface RegisteredCredentials {
  email: string;
  password: string;
}

/**
 * Registers a real user via the live `services/auth` instance's own
 * `POST /auth/register` (BAC-5) -- NOT a direct DB insert -- so the caller
 * gets `services/auth`'s real bootstrap-admin behavior for free: the FIRST
 * user ever registered against a tenant's schema is auto-assigned
 * `super_admin`; every subsequent one defaults to `staff` (BAC-7).
 */
async function registerUser(
  tenantSlug: string,
  credentials: RegisteredCredentials,
): Promise<void> {
  const response = await fetch('http://localhost:3002/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantSlug },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    throw new Error(
      `register(${credentials.email}) failed: ${response.status} ${await response.text()}`,
    );
  }
}

async function loginDirect(
  tenantSlug: string,
  credentials: RegisteredCredentials,
): Promise<{ accessToken: string }> {
  const response = await fetch('http://localhost:3002/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantSlug },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    throw new Error(
      `login(${credentials.email}) failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as { accessToken: string };
}

/**
 * Enrolls and activates real TOTP-based MFA (BAC-6) for a just-logged-in
 * user, via the live `services/auth` instance's own `mfa/enroll` +
 * `mfa/verify` endpoints -- computing a genuinely valid current code with
 * the same `otplib` the server verifies against, so the resulting account
 * has REAL active MFA indistinguishable from one a user enrolled themselves.
 */
async function enrollAndActivateMfa(
  tenantSlug: string,
  accessToken: string,
): Promise<void> {
  const enrollResponse = await fetch('http://localhost:3002/auth/mfa/enroll', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': tenantSlug,
    },
  });
  if (!enrollResponse.ok) {
    throw new Error(`mfa/enroll failed: ${enrollResponse.status}`);
  }
  const { secret } = (await enrollResponse.json()) as { secret: string };

  const verifyResponse = await fetch('http://localhost:3002/auth/mfa/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': tenantSlug,
    },
    body: JSON.stringify({ totpCode: generateTotpCode(secret) }),
  });
  if (!verifyResponse.ok) {
    throw new Error(`mfa/verify failed: ${verifyResponse.status}`);
  }
}

async function main(): Promise<void> {
  const pool: Pool = createInMemoryPool();
  await createTenantsTable(pool);

  const tenantId = randomUUID();
  const tenantSlug = 'acme-clinic';
  const schemaName = 'acme_clinic';
  await pool.query(
    `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan, owner_email)
     VALUES ($1, $2, 'active', $3, $4, $5, $6)`,
    [tenantId, tenantSlug, schemaName, 'Acme Clinic', 'starter', 'owner@acme-clinic.example.com'],
  );
  await pool.query(`CREATE SCHEMA ${schemaName}`);

  const apps: INestApplication[] = [
    await bootTenant(pool),
    await bootAuth(pool),
    await bootNotification(pool),
  ];

  const jwt = new JwtService();
  const JWT_ACCESS_SECRET = 'dev-insecure-access-secret-change-me';
  const sign = (payload: AccessTokenPayload): string =>
    jwt.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: 3600,
    });

  const superAdminToken = sign({ userId: randomUUID(), tenantId, role: 'super_admin' });
  const staffToken = sign({ userId: randomUUID(), tenantId, role: 'staff' });

  // BAC-13 fixtures: real users registered through the live auth service
  // itself (not DB inserts), so bootstrap-admin (BAC-7: the registrant whose
  // email exactly matches the tenant's `ownerEmail` becomes super_admin --
  // see AuthService.register's doc comment) and MFA (BAC-6) behave exactly
  // as they would for a real signup. Email MUST match the `owner_email`
  // seeded on the tenant row above.
  const noMfaUser = {
    email: 'owner@acme-clinic.example.com',
    password: 'Sup3rSecret!234',
  };
  const mfaUser = {
    email: 'staff-mfa@acme-clinic.example.com',
    password: 'Sup3rSecret!234',
  };
  await registerUser(tenantSlug, noMfaUser); // first-ever -> auto super_admin, no MFA
  await registerUser(tenantSlug, mfaUser); // second -> staff, MFA enrolled below
  const mfaUserTokens = await loginDirect(tenantSlug, mfaUser);
  await enrollAndActivateMfa(tenantSlug, mfaUserTokens.accessToken);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        status: 'ready',
        services: {
          tenant: 'http://localhost:3001',
          auth: 'http://localhost:3002',
          notification: 'http://localhost:3004',
        },
        seededTenant: { id: tenantId, slug: tenantSlug, schemaName },
        loginFixtures: {
          workspace: tenantSlug,
          superAdminNoMfa: noMfaUser,
          staffWithActiveMfa: mfaUser,
        },
        tokens: {
          superAdmin: superAdminToken,
          staff: staffToken,
        },
        localStorageKey: 'hep.accessToken',
      },
      null,
      2,
    ),
  );

  const shutdown = async (): Promise<void> => {
    await Promise.all(apps.map((app) => app.close()));
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
