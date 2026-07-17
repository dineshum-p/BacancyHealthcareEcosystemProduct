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
 * Regression test closing the CORS gap this service shipped with (it never
 * called `app.enableCors(...)` at all, unlike `services/tenant`/`auth`/
 * `patient`): without this, every browser request from `apps/web` --
 * including the preflight `OPTIONS` -- is blocked before it ever reaches a
 * route handler. Mirrors `services/tenant`'s `test/cors.e2e-spec.ts` from
 * BAC-12.
 */
describe('CORS (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'cors-e2e-test-secret';
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
    // Mirrors `src/main.ts`'s bootstrap exactly -- this is the line under test.
    app.enableCors(getCorsConfig());
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

  it('answers a cross-origin preflight OPTIONS for POST /billing/usage/events with Access-Control-Allow-Origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/billing/usage/events')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'authorization,content-type,x-tenant-id',
      );

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('does not send Access-Control-Allow-Origin for an origin outside the allow-list', async () => {
    const response = await request(app.getHttpServer())
      .options('/billing/usage/events')
      .set('Origin', 'https://not-allowed.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
