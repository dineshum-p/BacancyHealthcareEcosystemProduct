import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AccessTokenPayload, TenantSummary } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { AUTH_SERVICE_CLIENT } from '../src/onboarding/clients/auth-service.client';
import { NOTIFICATION_SERVICE_CLIENT } from '../src/onboarding/clients/notification-service.client';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

/**
 * Independent, black-box contract/integration check for BAC-12 written by
 * api-tester as a SEPARATE check from the backend-engineer's own e2e suite
 * (`test/onboarding.e2e-spec.ts`) -- exercises scenarios that file does not:
 * an admin-seed-succeeds-but-invite-fails partial failure (AC3's third case),
 * an active tenant appearing correctly in the list immediately (AC1), and
 * RBAC rejection for `clinic_admin`/`provider` roles specifically (AC4)
 * rather than just `staff`.
 */
describe('BAC-12: Tenant onboarding console (api-tester independent check)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let authServiceClient: { seedClinicAdmin: jest.Mock };
  let notificationServiceClient: { sendAdminInvite: jest.Mock };

  const JWT_ACCESS_SECRET = 'api-tester-onboarding-secret';

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
    process.env.INTERNAL_SERVICE_KEY = 'api-tester-internal-key';

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

  // AC1: onboard a tenant, confirm it shows up as active in GET /tenants
  // immediately afterward.
  it('AC1: a newly onboarded tenant appears in GET /tenants as active immediately after onboarding', async () => {
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'succeeded',
    });
    notificationServiceClient.sendAdminInvite.mockResolvedValue({
      outcome: 'succeeded',
    });
    const token = superAdminTokenFor(tenants.tenantA);

    const onboardResponse = await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Api Tester Clinic',
        slug: 'api-tester-clinic',
        plan: 'starter',
        adminEmail: 'admin@api-tester-clinic.example.com',
      })
      .expect(201);

    const newTenantId = (onboardResponse.body as { tenant: { id: string } })
      .tenant.id;

    const listResponse = await request(app.getHttpServer())
      .get('/tenants')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listed = (listResponse.body as TenantSummary[]).find(
      (t) => t.id === newTenantId,
    );
    expect(listed).toBeDefined();
    expect(listed).toMatchObject({
      status: 'active',
      slug: 'api-tester-clinic',
      adminSeedStatus: 'succeeded',
      inviteStatus: 'succeeded',
    });
  });

  // AC2: the onboarding call passes the correct arguments to seed a
  // clinic_admin and to send an invite -- verifying the orchestration
  // actually calls out with the right tenant id/email/tenant name, which is
  // what would let the sibling services do their real work (verified
  // independently against those services in their own suites).
  it('AC2: onboarding calls the auth client to seed a clinic_admin and the notification client to send an invite, with correct arguments', async () => {
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'succeeded',
    });
    notificationServiceClient.sendAdminInvite.mockResolvedValue({
      outcome: 'succeeded',
    });
    const token = superAdminTokenFor(tenants.tenantA);

    const response = await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Arg Check Clinic',
        slug: 'arg-check-clinic',
        plan: 'pro',
        adminEmail: 'admin@arg-check-clinic.example.com',
      })
      .expect(201);

    const tenantId = (response.body as { tenant: { id: string } }).tenant.id;

    expect(authServiceClient.seedClinicAdmin).toHaveBeenCalledTimes(1);
    expect(authServiceClient.seedClinicAdmin).toHaveBeenCalledWith(
      tenantId,
      'admin@arg-check-clinic.example.com',
    );
    expect(notificationServiceClient.sendAdminInvite).toHaveBeenCalledTimes(1);
    expect(notificationServiceClient.sendAdminInvite).toHaveBeenCalledWith(
      tenantId,
      'admin@arg-check-clinic.example.com',
      'Arg Check Clinic',
    );
  });

  // AC3, third partial-failure case (not covered by the engineer's own
  // spec): admin-seed SUCCEEDS but the invite call FAILS -- the tenant must
  // be left active with a real clinic_admin but inviteStatus=failed, visible
  // via GET /tenants, not silently reported as full success.
  it('AC3: reports adminSeedStatus=succeeded but inviteStatus=failed, persisted and visible via GET /tenants, when only the invite step fails', async () => {
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'succeeded',
    });
    notificationServiceClient.sendAdminInvite.mockResolvedValue({
      outcome: 'failed',
      error: 'notification service unreachable',
    });
    const token = superAdminTokenFor(tenants.tenantA);

    const response = await request(app.getHttpServer())
      .post('/tenants/onboard')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Invite Fails Co',
        slug: 'invite-fails-co',
        plan: 'starter',
        adminEmail: 'admin@invite-fails-co.example.com',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      tenant: {
        status: 'active',
        adminSeedStatus: 'succeeded',
        inviteStatus: 'failed',
      },
      adminSeed: { status: 'succeeded' },
      invite: { status: 'failed', message: 'notification service unreachable' },
    });

    const tenantId = (response.body as { tenant: { id: string } }).tenant.id;
    const listResponse = await request(app.getHttpServer())
      .get('/tenants')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listed = (listResponse.body as TenantSummary[]).find(
      (t) => t.id === tenantId,
    );
    expect(listed).toMatchObject({
      status: 'active',
      adminSeedStatus: 'succeeded',
      inviteStatus: 'failed',
    });
  });

  // AC4: clinic_admin and provider (not just staff) both get 403, on BOTH
  // endpoints -- broader role coverage than the engineer's own spec.
  const nonSuperAdminRoles: Array<'clinic_admin' | 'provider' | 'staff'> = [
    'clinic_admin',
    'provider',
    'staff',
  ];

  for (const role of nonSuperAdminRoles) {
    it(`AC4: role="${role}" gets 403 on POST /tenants/onboard`, async () => {
      const token = signToken({
        userId: `user-${role}`,
        tenantId: tenants.tenantA.id,
        role,
      });

      await request(app.getHttpServer())
        .post('/tenants/onboard')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `${role} Denied Co`,
          slug: `${role}-denied-co`,
          plan: 'starter',
          adminEmail: `admin@${role}-denied-co.example.com`,
        })
        .expect(403);

      expect(authServiceClient.seedClinicAdmin).not.toHaveBeenCalled();
      expect(notificationServiceClient.sendAdminInvite).not.toHaveBeenCalled();
    });

    it(`AC4: role="${role}" gets 403 on GET /tenants`, async () => {
      const token = signToken({
        userId: `user-${role}`,
        tenantId: tenants.tenantA.id,
        role,
      });

      await request(app.getHttpServer())
        .get('/tenants')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  }
});
