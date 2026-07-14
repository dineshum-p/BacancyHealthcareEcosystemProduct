import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { getCorsConfig } from '../src/config/cors.config';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';

/**
 * Regression test for the CORS bug qa-tester reproduced against the live dev
 * stack (BAC-13): `apps/web` calls `services/auth` cross-origin for
 * `POST /auth/login` and `POST /auth/mfa/login-verify` (see
 * `apps/web/src/lib/api/authApi.ts`) -- they are separate deployables, on
 * different ports/origins even in local dev -- and NestJS never enables CORS
 * by default. Without `app.enableCors(...)` wired the same way `src/main.ts`
 * wires it (via `getCorsConfig()`), a browser blocks the preflight `OPTIONS`
 * before it ever reaches a route handler -- reproduced here by bootstrapping
 * the app the same way `main.ts` does and asserting the response actually
 * carries `Access-Control-Allow-Origin` for an allowed dev origin.
 *
 * Mirrors `services/tenant`'s `test/cors.e2e-spec.ts` from BAC-12 (the same
 * bug class already fixed once on that service).
 */
describe('CORS (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'cors-e2e-test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
    process.env.REFRESH_TOKEN_TTL_SECONDS = '604800';
    delete process.env.CORS_ALLOWED_ORIGINS;

    pool = createInMemoryPool();
    await createTenantsTable(pool);

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
    // Mirrors `src/main.ts`'s bootstrap exactly -- this is the line under test.
    app.enableCors(getCorsConfig());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a cross-origin preflight OPTIONS for POST /auth/login with Access-Control-Allow-Origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-tenant-id');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3002',
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('answers a cross-origin preflight OPTIONS for POST /auth/mfa/login-verify with Access-Control-Allow-Origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/auth/mfa/login-verify')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-tenant-id');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3002',
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('does not send Access-Control-Allow-Origin for an origin outside the allow-list', async () => {
    const response = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'https://not-allowed.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
