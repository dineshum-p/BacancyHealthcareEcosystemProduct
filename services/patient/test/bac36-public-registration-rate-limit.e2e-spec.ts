import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { DOMAIN_EVENT_PUBLISHER } from '../src/events/events.constants';
import { DomainEventPublisher } from '../src/events/domain-event-publisher.interface';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Proves BAC-36's rate-limiting AC in isolation, with its OWN app instance
 * configured with a tiny `PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT` (read by
 * `getPublicRegistrationThrottleConfig`) -- kept in its own file/app,
 * separate from `bac36-patient-self-registration.e2e-spec.ts`'s much larger
 * functional suite, for two reasons: (1) `@nestjs/throttler`'s
 * `ThrottlerGuard` tracks hits per (IP, controller, handler) for the
 * lifetime of one Nest app instance, so sharing an app between "assert a
 * normal 201" tests and "assert the limit trips" tests would make the
 * former flaky depending on how many public-endpoint calls preceded them in
 * file order; (2) it lets this suite use a deliberately tiny limit without
 * needing to also raise it for every other functional test in this service.
 */
describe('Public patient self-registration rate limiting (e2e, BAC-36)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;

  const RATE_LIMIT = 3;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-rate-limit-test-secret';
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT = String(RATE_LIMIT);
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_TTL_MS = '60000';

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    const fakeEventPublisher: jest.Mocked<DomainEventPublisher> = {
      publishPatientCreated: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(DOMAIN_EVENT_PUBLISHER)
      .useValue(fakeEventPublisher)
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

  it(`allows the first ${RATE_LIMIT} submissions from the same caller, then rejects further ones with 429`, async () => {
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: `RateLimited${i}`,
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
      .send({
        firstName: 'OneTooMany',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
      })
      .expect(429);
  });
});
