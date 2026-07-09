import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AccessTokenPayload } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import type { Item } from '../src/items/item.entity';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-tenant-isolation-test-secret';

/**
 * Proves BAC-4's acceptance criteria end-to-end against a real (not mocked)
 * SQL engine: two tenants, each with their own Postgres schema, resolved
 * from an `X-Tenant-Id` header and bound to isolated database connections
 * for the lifetime of the request.
 *
 * Runs against `pg-mem` (an in-process, spec-compliant SQL engine) so it
 * executes without requiring a docker daemon. Production and `docker-compose
 * .test.yml` both use the real `pg` driver against real Postgres; only the
 * `PG_POOL` provider is swapped here, so the exact same repository/service
 * code under test runs unmodified in both environments.
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();

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

  /**
   * `POST /items` requires an access token as of BAC-8's review fix (actor
   * capture, AC1). This suite doesn't care about the audit trail itself, only
   * tenant isolation, but it must supply a token matching the tenant it's
   * writing under -- `AccessTokenGuard` cross-checks the token's `tenantId`
   * claim against the resolved `X-Tenant-Id`.
   */
  function tokenFor(tenant: { id: string }): string {
    const payload: AccessTokenPayload = {
      userId: 'isolation-test-user',
      tenantId: tenant.id,
      role: 'staff',
    };
    return jwtService.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: 900,
    });
  }

  it('resolves the correct tenant from X-Tenant-Id (AC1, AC4)', async () => {
    const response = await request(app.getHttpServer())
      .get('/tenant-context/me')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .expect(200);

    expect(response.body).toMatchObject({
      slug: 'tenant-a',
      schemaName: 'tenant_a',
      status: 'active',
    });
  });

  it('never includes ownerEmail in the GET /tenant-context/me response (BAC-7 review, 3rd leak point)', async () => {
    // `GET /tenant-context/me` is reachable with nothing but a guessable
    // `X-Tenant-Id` header (no user-identity check) -- see
    // `tenant-context.controller.ts`'s doc comment. Guard against the exact
    // regression that let `ownerEmail` (the bootstrap-admin secret) leak
    // through this third, previously-unaudited route.
    const response = await request(app.getHttpServer())
      .get('/tenant-context/me')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .expect(200);

    expect(response.body).not.toHaveProperty('ownerEmail');
    // Raw substring check on the wire payload (not just the typed field) so
    // this also catches the secret leaking under a renamed/nested key.
    expect(response.text).not.toContain('owner-a@example.com');
    expect(response.text.toLowerCase()).not.toContain('owneremail');
  });

  it('returns 404 for an unknown tenant and touches no schema', async () => {
    await request(app.getHttpServer())
      .get('/items')
      .set('X-Tenant-Id', 'does-not-exist')
      .expect(404);
  });

  it('returns 403 for an inactive tenant and touches no schema', async () => {
    await request(app.getHttpServer())
      .get('/items')
      .set('X-Tenant-Id', tenants.inactiveTenant.slug)
      .expect(403);
  });

  it('a query executed under tenant A cannot read rows written under tenant B (AC3)', async () => {
    const resA = await request(app.getHttpServer())
      .get('/items')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .expect(200);
    const resB = await request(app.getHttpServer())
      .get('/items')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .expect(200);

    expect(resA.body).toEqual([
      expect.objectContaining({ name: 'tenant-a seed item' }),
    ]);
    expect(resB.body).toEqual([
      expect.objectContaining({ name: 'tenant-b seed item' }),
    ]);
  });

  it('writes made under tenant A are invisible to tenant B (AC3)', async () => {
    await request(app.getHttpServer())
      .post('/items')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${tokenFor(tenants.tenantA)}`)
      .send({ name: 'only-in-tenant-a' })
      .expect(201);

    const resB = await request(app.getHttpServer())
      .get('/items')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .expect(200);

    const itemsB = resB.body as Item[];
    expect(itemsB.some((item) => item.name === 'only-in-tenant-a')).toBe(false);

    const resA = await request(app.getHttpServer())
      .get('/items')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .expect(200);

    const itemsA = resA.body as Item[];
    expect(itemsA.some((item) => item.name === 'only-in-tenant-a')).toBe(true);
  });
});
