import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { TenantsRepository } from '../src/tenants/tenants.repository';
import { TenantStatus } from '../src/tenants/tenant-status.enum';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import type { Tenant } from '../src/tenants/tenant.entity';

/**
 * Proves BAC-3's acceptance criteria end-to-end against a real (not mocked)
 * SQL engine, the same `pg-mem` approach BAC-4 established (see
 * `tenant-isolation.e2e-spec.ts`): production and `docker-compose.test.yml`
 * both use the real `pg` driver against real Postgres; only the `PG_POOL`
 * provider is swapped here.
 */
describe('Tenant provisioning (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('provisions a tenant with a real, queryable Postgres schema (AC1, AC2)', async () => {
    const response = await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'Acme Inc',
        slug: 'acme-corp',
        plan: 'starter',
        ownerEmail: 'owner@acme-corp.example.com',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      slug: 'acme-corp',
      name: 'Acme Inc',
      plan: 'starter',
      status: 'active',
      schemaName: 'tenant_acme_corp',
    });
    // BAC-7 review: `ownerEmail` is the bootstrap-admin secret bound at
    // tenant-creation time (see `AuthService.register`'s doc comment) and
    // `POST /tenants` is deliberately UNAUTHENTICATED, so it must never
    // appear in this response body -- otherwise anyone could read it back
    // here and win the bootstrap-admin race.
    expect(response.body).not.toHaveProperty('ownerEmail');
    const createdTenant = response.body as Tenant;
    expect(typeof createdTenant.id).toBe('string');
    expect(createdTenant.id.length).toBeGreaterThan(0);

    // AC2: the dedicated schema (+ baseline "items" table) really exists
    // and is queryable, not just recorded in the registry row.
    await pool.query(
      'INSERT INTO "tenant_acme_corp".items (name) VALUES ($1)',
      ['seed'],
    );
    const items = await pool.query('SELECT name FROM "tenant_acme_corp".items');
    expect(items.rows).toEqual([{ name: 'seed' }]);
  });

  it('rejects a duplicate slug with 409 (AC3)', async () => {
    await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'First Co',
        slug: 'dup-tenant',
        plan: 'starter',
        ownerEmail: 'owner@first-co.example.com',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'Second Co',
        slug: 'dup-tenant',
        plan: 'pro',
        ownerEmail: 'owner@second-co.example.com',
      })
      .expect(409);
  });

  it('rejects tenant creation with a missing ownerEmail with 400 (BAC-7)', async () => {
    await request(app.getHttpServer())
      .post('/tenants')
      .send({ name: 'No Owner Co', slug: 'no-owner-co', plan: 'starter' })
      .expect(400);
  });

  it('rejects tenant creation with an invalid ownerEmail with 400 (BAC-7)', async () => {
    await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'Bad Owner Co',
        slug: 'bad-owner-co',
        plan: 'starter',
        ownerEmail: 'not-an-email',
      })
      .expect(400);
  });

  it('returns 404 for an unknown tenant id', async () => {
    await request(app.getHttpServer())
      .get('/tenants/does-not-exist')
      .expect(404);
  });

  it('returns the created tenant with its active status by id (AC4)', async () => {
    const created = await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'Gamma LLC',
        slug: 'gamma-llc',
        plan: 'starter',
        ownerEmail: 'owner@gamma-llc.example.com',
      })
      .expect(201);
    const createdTenant = created.body as Tenant;

    const fetched = await request(app.getHttpServer())
      .get(`/tenants/${createdTenant.id}`)
      .expect(200);

    expect(fetched.body).toMatchObject({
      id: createdTenant.id,
      slug: 'gamma-llc',
      status: 'active',
    });
    // BAC-7 review: same reasoning as the POST assertion above -- `GET
    // /tenants/:id` is also UNAUTHENTICATED, so learning a tenant's id (its
    // slug or a guessed/enumerated UUID) must never be enough to also learn
    // its `ownerEmail`.
    expect(fetched.body).not.toHaveProperty('ownerEmail');
  });

  it('reflects the pending -> active provisioning status transition on GET (AC4)', async () => {
    // Drives the registry directly (same production TenantsRepository code
    // path the app uses) to observe the intermediate `pending` state that a
    // real deployment's provisioning step passes through, independent of
    // this test app's synchronous create-then-provision timing.
    const tenantsRepository = new TenantsRepository(pool);
    const pending = await tenantsRepository.create({
      id: 'transition-tenant',
      slug: 'transition-tenant',
      name: 'Transition Co',
      plan: 'starter',
      status: TenantStatus.PENDING,
      schemaName: 'tenant_transition',
      ownerEmail: 'owner@transition.example.com',
      adminSeedStatus: null,
      inviteStatus: null,
    });

    const whilePending = await request(app.getHttpServer())
      .get(`/tenants/${pending.id}`)
      .expect(200);
    expect(whilePending.body).toMatchObject({ status: 'pending' });

    await tenantsRepository.updateStatus(pending.id, TenantStatus.ACTIVE);

    const afterActivation = await request(app.getHttpServer())
      .get(`/tenants/${pending.id}`)
      .expect(200);
    expect(afterActivation.body).toMatchObject({ status: 'active' });
  });
});
