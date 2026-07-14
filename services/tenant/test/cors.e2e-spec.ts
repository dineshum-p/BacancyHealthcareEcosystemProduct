import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { AUTH_SERVICE_CLIENT } from '../src/onboarding/clients/auth-service.client';
import { NOTIFICATION_SERVICE_CLIENT } from '../src/onboarding/clients/notification-service.client';
import { getCorsConfig } from '../src/config/cors.config';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';

/**
 * Regression test for the CORS bug qa-tester reproduced against the live
 * dev stack (BAC-12): `apps/web` calls `services/tenant` cross-origin (they
 * are separate deployables, on different ports/origins even in local dev),
 * and NestJS never enables CORS by default. Without `app.enableCors(...)`
 * wired the same way `src/main.ts` wires it (via `getCorsConfig()`), a
 * browser blocks the preflight `OPTIONS` before it ever reaches a route
 * handler -- reproduced here by bootstrapping the app the same way
 * `main.ts` does and asserting the response actually carries
 * `Access-Control-Allow-Origin` for an allowed dev origin.
 */
describe('CORS (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'cors-e2e-test-secret';
    process.env.INTERNAL_SERVICE_KEY = 'cors-e2e-internal-key';
    delete process.env.CORS_ALLOWED_ORIGINS;

    pool = createInMemoryPool();
    await createTenantsTable(pool);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(AUTH_SERVICE_CLIENT)
      .useValue({ seedClinicAdmin: jest.fn() })
      .overrideProvider(NOTIFICATION_SERVICE_CLIENT)
      .useValue({ sendAdminInvite: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    // Mirrors `src/main.ts`'s bootstrap exactly -- this is the line under test.
    app.enableCors(getCorsConfig());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a cross-origin preflight OPTIONS for POST /tenants/onboard with Access-Control-Allow-Origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/tenants/onboard')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'authorization,content-type,x-tenant-id',
      );

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3002',
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('answers a cross-origin preflight OPTIONS for GET /tenants with Access-Control-Allow-Origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/tenants')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,x-tenant-id');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3002',
    );
    expect(response.headers['access-control-allow-methods']).toContain('GET');
  });

  it('does not send Access-Control-Allow-Origin for an origin outside the allow-list', async () => {
    const response = await request(app.getHttpServer())
      .options('/tenants/onboard')
      .set('Origin', 'https://not-allowed.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
