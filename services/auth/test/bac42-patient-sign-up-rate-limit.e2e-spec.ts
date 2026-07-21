import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Proves BAC-42's rate-limiting AC in isolation, with its OWN app instance
 * configured with a tiny `PATIENT_SIGN_UP_RATE_LIMIT` (read by
 * `getPatientSignUpThrottleConfig`) -- mirrors `services/patient`'s BAC-36
 * `bac36-public-registration-rate-limit.e2e-spec.ts` exactly, including
 * keeping this in its OWN file/app: `@nestjs/throttler`'s `ThrottlerGuard`
 * tracks hits per (IP, controller, handler) for the lifetime of one Nest app
 * instance, so sharing an app with the larger functional suite
 * (`bac42-patient-sign-up.e2e-spec.ts`) would make ordinary 201 assertions
 * flaky depending on how many prior calls hit the same route in file order.
 */
describe('POST /auth/patients/register rate limiting (e2e, BAC-42)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  const RATE_LIMIT = 3;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-patient-sign-up-rate-limit-secret';
    process.env.PATIENT_SIGN_UP_RATE_LIMIT = String(RATE_LIMIT);
    process.env.PATIENT_SIGN_UP_RATE_TTL_MS = '60000';

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
    delete process.env.PATIENT_SIGN_UP_RATE_LIMIT;
    delete process.env.PATIENT_SIGN_UP_RATE_TTL_MS;
  });

  it(`allows the first ${RATE_LIMIT} sign-ups from the same caller, then rejects further ones with 429`, async () => {
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/patients/register')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send({
          email: `${randomUUID()}@example.com`,
          password: 'super-secret-1',
          firstName: `RateLimited${i}`,
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/patients/register')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({
        email: `${randomUUID()}@example.com`,
        password: 'super-secret-1',
        firstName: 'OneTooMany',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
      })
      .expect(429);
  });

  it('does not rate-limit POST /auth/register (the throttle is scoped to the patient sign-up route only)', async () => {
    for (let i = 0; i < RATE_LIMIT + 2; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send({
          email: `${randomUUID()}@example.com`,
          password: 'super-secret-1',
        })
        .expect(201);
    }
  });
});
