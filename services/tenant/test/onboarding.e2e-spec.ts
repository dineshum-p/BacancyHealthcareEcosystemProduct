import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  OnboardTenantResponse,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { AUTH_SERVICE_CLIENT } from '../src/onboarding/clients/auth-service.client';
import { NOTIFICATION_SERVICE_CLIENT } from '../src/onboarding/clients/notification-service.client';
import type { OrchestrationStepResult } from '../src/onboarding/clients/orchestration-step-result.interface';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-onboarding-test-secret';

/**
 * Proves BAC-12's acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`, same approach as every other e2e spec in
 * this service), with `AUTH_SERVICE_CLIENT`/`NOTIFICATION_SERVICE_CLIENT`
 * overridden by fakes -- `services/auth` and `services/notification` are
 * separately-deployable Nest apps that cannot realistically be spun up
 * in-process here, so the sibling-service HTTP boundary itself is exactly
 * what's faked (matching this ticket's instruction to mock those calls),
 * while everything else (real guards, real DB, real orchestration
 * sequencing) runs unmodified.
 */
describe('Tenant onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let authServiceClient: { seedClinicAdmin: jest.Mock };
  let notificationServiceClient: { sendAdminInvite: jest.Mock };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
    process.env.INTERNAL_SERVICE_KEY = 'e2e-internal-service-key';

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();

    authServiceClient = { seedClinicAdmin: jest.fn() };
    notificationServiceClient = { sendAdminInvite: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(AUTH_SERVICE_CLIENT)
      .useValue(authServiceClient)
      .overrideProvider(NOTIFICATION_SERVICE_CLIENT)
      .useValue(notificationServiceClient)
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

  beforeEach(() => {
    authServiceClient.seedClinicAdmin.mockReset();
    notificationServiceClient.sendAdminInvite.mockReset();
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

  const succeeded: OrchestrationStepResult = { outcome: 'succeeded' };

  it('onboards a tenant end-to-end: provisions it, seeds the admin, and queues the invite (AC1/AC2)', async () => {
    authServiceClient.seedClinicAdmin.mockResolvedValue(succeeded);
    notificationServiceClient.sendAdminInvite.mockResolvedValue(succeeded);
    const token = superAdminTokenFor(tenants.tenantA);

    const response = await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Clinic',
        slug: 'new-clinic',
        plan: 'starter',
        adminEmail: 'admin@new-clinic.example.com',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      tenant: {
        slug: 'new-clinic',
        name: 'New Clinic',
        plan: 'starter',
        status: 'active',
        adminSeedStatus: 'succeeded',
        inviteStatus: 'succeeded',
      },
      adminSeed: { status: 'succeeded' },
      invite: { status: 'succeeded' },
    });
    const body = response.body as OnboardTenantResponse;
    expect(body.tenant).not.toHaveProperty('ownerEmail');

    expect(authServiceClient.seedClinicAdmin).toHaveBeenCalledWith(
      body.tenant.id,
      'admin@new-clinic.example.com',
    );

    expect(notificationServiceClient.sendAdminInvite).toHaveBeenCalledWith(
      body.tenant.id,
      'admin@new-clinic.example.com',
      'New Clinic',
    );

    // AC3: the same result is visible later via GET /tenants.
    const list = await request(app.getHttpServer())
      .get('/tenants')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listedTenant = (
      list.body as Array<{ id: string; adminSeedStatus: string }>
    ).find((tenant) => tenant.id === body.tenant.id);
    expect(listedTenant).toMatchObject({
      adminSeedStatus: 'succeeded',
      inviteStatus: 'succeeded',
    });
  });

  it('skips the invite and reports adminSeedStatus=failed when the auth service call fails (partial failure)', async () => {
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'failed',
      error: 'auth service unreachable',
    });
    const token = superAdminTokenFor(tenants.tenantA);

    const response = await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Partial Co',
        slug: 'partial-co',
        plan: 'starter',
        adminEmail: 'admin@partial-co.example.com',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      tenant: {
        status: 'active',
        adminSeedStatus: 'failed',
        inviteStatus: 'skipped',
      },
      adminSeed: { status: 'failed', message: 'auth service unreachable' },
      invite: { status: 'skipped' },
    });

    expect(notificationServiceClient.sendAdminInvite).not.toHaveBeenCalled();
  });

  it('rejects a duplicate slug with 409 and never attempts admin-seeding or the invite', async () => {
    authServiceClient.seedClinicAdmin.mockResolvedValue(succeeded);
    notificationServiceClient.sendAdminInvite.mockResolvedValue(succeeded);
    const token = superAdminTokenFor(tenants.tenantA);
    const payload = {
      name: 'Dup Onboard Co',
      slug: 'dup-onboard-co',
      plan: 'starter',
      adminEmail: 'admin@dup-onboard-co.example.com',
    };

    await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    authServiceClient.seedClinicAdmin.mockClear();
    notificationServiceClient.sendAdminInvite.mockClear();

    await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(409);

    expect(authServiceClient.seedClinicAdmin).not.toHaveBeenCalled();

    expect(notificationServiceClient.sendAdminInvite).not.toHaveBeenCalled();
  });

  it('POST /tenants/onboard requires authentication (401 with no Bearer token) (AC4)', async () => {
    await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({
        name: 'Unauth Co',
        slug: 'unauth-co',
        plan: 'starter',
        adminEmail: 'admin@unauth-co.example.com',
      })
      .expect(401);
  });

  it('POST /tenants/onboard rejects an authenticated non-super_admin role with 403, not 401 (AC4)', async () => {
    const token = signToken({
      userId: 'staff-1',
      tenantId: tenants.tenantA.id,
      role: 'staff',
    });

    await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Staff Denied Co',
        slug: 'staff-denied-co',
        plan: 'starter',
        adminEmail: 'admin@staff-denied-co.example.com',
      })
      .expect(403);
  });

  it('GET /tenants requires authentication and super_admin (AC4)', async () => {
    await request(app.getHttpServer())
      .get('/tenants')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .expect(401);

    const clinicAdminToken = signToken({
      userId: 'clinic-admin-1',
      tenantId: tenants.tenantA.id,
      role: 'clinic_admin',
    });
    await request(app.getHttpServer())
      .get('/tenants')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${clinicAdminToken}`)
      .expect(403);
  });

  it('GET /tenants lists every tenant, never including ownerEmail (AC3, BAC-7 review)', async () => {
    const token = superAdminTokenFor(tenants.tenantA);

    const response = await request(app.getHttpServer())
      .get('/tenants')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const list = response.body as Array<Record<string, unknown>>;
    expect(list.length).toBeGreaterThanOrEqual(3); // seeded fixtures + prior onboarded tenants in this suite
    expect(list.some((tenant) => tenant.id === tenants.tenantA.id)).toBe(true);
    for (const tenant of list) {
      expect(tenant).not.toHaveProperty('ownerEmail');
    }
  });
});
