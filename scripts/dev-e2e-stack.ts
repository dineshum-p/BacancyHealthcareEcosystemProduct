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
import { AppModule as AuthAppModule } from '../services/auth/src/app.module';
import { PG_POOL as AUTH_PG_POOL } from '../services/auth/src/database/database.tokens';
import { AppModule as NotificationAppModule } from '../services/notification/src/app.module';
import { PG_POOL as NOTIFICATION_PG_POOL } from '../services/notification/src/database/database.tokens';

/**
 * Dev-only, throwaway harness (NOT shipped/built/CI'd) that boots real
 * listening instances of services/tenant (:3000), services/auth (:3001), and
 * services/notification (:3003) sharing ONE in-memory (pg-mem) Postgres pool
 * -- so `apps/web` can be pointed at real, live backends for browser E2E in
 * a sandbox with no Docker/Postgres available (see the BAC-12 pipeline
 * session notes). All three point at the SAME pool object, mirroring the
 * "same Postgres cluster" assumption every service's own .env.example
 * documents for a real deployment.
 *
 * Uses `@nestjs/testing`'s `Test.createTestingModule(...).overrideProvider`
 * -- the exact mechanism every service's own e2e-spec already uses to swap
 * in pg-mem -- just calling `.listen(port)` on the resulting app instead of
 * driving it with supertest.
 *
 * Usage: npx ts-node --project services/tenant/tsconfig.json --transpile-only scripts/dev-e2e-stack.ts
 */

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3003';

async function bootTenant(pool: Pool): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [TenantAppModule] })
    .overrideProvider(TENANT_PG_POOL)
    .useValue(pool)
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(3000);
  return app;
}

async function bootAuth(pool: Pool): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AuthAppModule] })
    .overrideProvider(AUTH_PG_POOL)
    .useValue(pool)
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(3001);
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
  await app.listen(3003);
  return app;
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

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        status: 'ready',
        services: {
          tenant: 'http://localhost:3000',
          auth: 'http://localhost:3001',
          notification: 'http://localhost:3003',
        },
        seededTenant: { id: tenantId, slug: tenantSlug, schemaName },
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
