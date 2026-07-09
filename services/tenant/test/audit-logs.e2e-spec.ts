import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AccessTokenPayload } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import type { Tenant } from '../src/tenants/tenant.entity';
import type { PaginatedAuditLogsDto } from '../src/audit-logs/dto/audit-log-response.dto';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-audit-logs-test-secret';

/**
 * Proves BAC-8's acceptance criteria end-to-end against a real (not mocked)
 * SQL engine, the same `pg-mem` approach BAC-3/4 established: production and
 * `docker-compose.test.yml` both use the real `pg` driver against real
 * Postgres; only the `PG_POOL` provider is swapped here.
 *
 * `services/tenant` never issues tokens itself, so these tests sign tokens
 * with a plain `JwtService` using the SAME secret this app is configured
 * with, standing in for `services/auth`'s own token issuance -- exactly the
 * "two separately-deployable services trusting the same signed JWT" setup
 * BAC-8 describes. `AccessTokenGuard` never queries a users table, so a
 * self-signed token with an arbitrary `userId` is a faithful stand-in.
 */
describe('Audit logs (e2e)', () => {
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

  function signToken(payload: AccessTokenPayload): string {
    return jwtService.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: 900,
    });
  }

  function superAdminTokenFor(tenant: { id: string }): string {
    return signToken({
      userId: 'super-admin-1',
      tenantId: tenant.id,
      role: 'super_admin',
    });
  }

  it('records POST /tenants as an audit entry with before=null and after=<created tenant> (AC1, AC4)', async () => {
    const created = await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'Audited Co',
        slug: 'audited-co',
        plan: 'starter',
        ownerEmail: 'owner@audited-co.example.com',
      })
      .expect(201);
    const createdTenant = created.body as Tenant;

    // The tenant's very first audit entry documents its own creation --
    // GET /audit-logs scoped to the tenant that was JUST created.
    const token = superAdminTokenFor(createdTenant);
    const auditResponse = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', createdTenant.id)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const page = auditResponse.body as PaginatedAuditLogsDto;

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      actorUserId: null,
      action: 'create',
      resourceType: 'tenant',
      resourceId: createdTenant.id,
      before: null,
    });
    expect(page.items[0].after).toMatchObject({ id: createdTenant.id });
    expect(typeof page.items[0].createdAt).toBe('string');
  });

  it('records POST /items as an audit entry with a real actorUserId, before=null and after=<created item> (AC1)', async () => {
    const creatorToken = superAdminTokenFor(tenants.tenantA);
    const itemResponse = await request(app.getHttpServer())
      .post('/items')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'audited widget' })
      .expect(201);
    const createdItem = itemResponse.body as { id: number; name: string };

    const token = superAdminTokenFor(tenants.tenantA);
    const auditResponse = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .query({ resourceType: 'item', resourceId: String(createdItem.id) })
      .expect(200);
    const page = auditResponse.body as PaginatedAuditLogsDto;

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      actorUserId: 'super-admin-1',
      action: 'create',
      resourceType: 'item',
      resourceId: String(createdItem.id),
      before: null,
      after: { id: createdItem.id, name: 'audited widget' },
    });
  });

  it('POST /items requires authentication (401 with no Bearer token) (AC1, AC7)', async () => {
    await request(app.getHttpServer())
      .post('/items')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({ name: 'unauthenticated widget' })
      .expect(401);
  });

  it('GET /audit-logs requires authentication (401 with no Bearer token) (AC7)', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .expect(401);
  });

  it('GET /audit-logs rejects an authenticated non-admin role with 403, not 401 (AC7)', async () => {
    const token = signToken({
      userId: 'staff-1',
      tenantId: tenants.tenantA.id,
      role: 'staff',
    });

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /audit-logs allows clinic_admin (not just super_admin) (AC3)', async () => {
    const token = signToken({
      userId: 'clinic-admin-1',
      tenantId: tenants.tenantA.id,
      role: 'clinic_admin',
    });

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects a token issued for a different tenant than X-Tenant-Id (401)', async () => {
    const token = superAdminTokenFor(tenants.tenantB);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('a mutation performed under tenant A never appears in tenant B audit query (AC4)', async () => {
    await request(app.getHttpServer())
      .post('/items')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${superAdminTokenFor(tenants.tenantA)}`)
      .send({ name: 'only-in-tenant-a-audit' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/items')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .set('Authorization', `Bearer ${superAdminTokenFor(tenants.tenantB)}`)
      .send({ name: 'only-in-tenant-b-audit' })
      .expect(201);

    const tokenA = superAdminTokenFor(tenants.tenantA);
    const auditA = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ limit: 100 })
      .expect(200);
    const pageA = auditA.body as PaginatedAuditLogsDto;

    const tokenB = superAdminTokenFor(tenants.tenantB);
    const auditB = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ limit: 100 })
      .expect(200);
    const pageB = auditB.body as PaginatedAuditLogsDto;

    const namesInA = pageA.items.map((item) => {
      const after = item.after as { name?: string } | null;
      return after?.name;
    });
    const namesInB = pageB.items.map((item) => {
      const after = item.after as { name?: string } | null;
      return after?.name;
    });

    expect(namesInA).toContain('only-in-tenant-a-audit');
    expect(namesInA).not.toContain('only-in-tenant-b-audit');
    expect(namesInB).toContain('only-in-tenant-b-audit');
    expect(namesInB).not.toContain('only-in-tenant-a-audit');
  });

  it('paginates results and filters by actor (AC3, AC7)', async () => {
    const uniqueTenant = await request(app.getHttpServer())
      .post('/tenants')
      .send({
        name: 'Pagination Co',
        slug: 'pagination-co',
        plan: 'starter',
        ownerEmail: 'owner@pagination-co.example.com',
      })
      .expect(201);
    const paginationTenant = uniqueTenant.body as Tenant;
    const token = superAdminTokenFor(paginationTenant);

    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post('/items')
        .set('X-Tenant-Id', paginationTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `item-${i}` })
        .expect(201);
    }

    const page1 = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', paginationTenant.slug)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 2 })
      .expect(200);
    const page1Body = page1.body as PaginatedAuditLogsDto;

    // 1 tenant-creation entry + 3 item-creation entries = 4 total.
    expect(page1Body.total).toBe(4);
    expect(page1Body.items).toHaveLength(2);
    expect(page1Body.page).toBe(1);
    expect(page1Body.limit).toBe(2);

    const page2 = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', paginationTenant.slug)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 2, limit: 2 })
      .expect(200);
    const page2Body = page2.body as PaginatedAuditLogsDto;

    expect(page2Body.items).toHaveLength(2);
    const page1Ids = page1Body.items.map((item) => item.id);
    const page2Ids = page2Body.items.map((item) => item.id);
    expect(page1Ids).not.toEqual(page2Ids);
  });

  it('rejects an invalid page query param with 400 (DTO validation)', async () => {
    const token = superAdminTokenFor(tenants.tenantA);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 'not-a-number' })
      .expect(400);
  });

  it('exposes no PATCH/PUT/DELETE route for audit logs -- append-only (AC2)', async () => {
    const token = superAdminTokenFor(tenants.tenantA);

    await request(app.getHttpServer())
      .patch('/audit-logs/some-id')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .put('/audit-logs/some-id')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete('/audit-logs/some-id')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
