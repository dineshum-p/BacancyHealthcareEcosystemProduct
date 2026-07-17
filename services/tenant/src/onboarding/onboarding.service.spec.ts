import { OnboardingService } from './onboarding.service';
import { TenantsService } from '../tenants/tenants.service';
import { TenantsRepository } from '../tenants/tenants.repository';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { Tenant } from '../tenants/tenant.entity';
import { AuthServiceClient } from './clients/auth-service.client';
import { NotificationServiceClient } from './clients/notification-service.client';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';

describe('OnboardingService', () => {
  let tenantsService: jest.Mocked<TenantsService>;
  let tenantsRepository: jest.Mocked<TenantsRepository>;
  let authServiceClient: jest.Mocked<AuthServiceClient>;
  let notificationServiceClient: jest.Mocked<NotificationServiceClient>;
  let service: OnboardingService;

  const dto: OnboardTenantDto = {
    name: 'Acme Inc',
    slug: 'acme',
    plan: 'starter',
    adminEmail: 'admin@acme.example.com',
    modules: ['clinic'],
  };

  const activeTenant: Tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'admin@acme.example.com',
    adminSeedStatus: null,
    inviteStatus: null,
    modules: [],
  };

  beforeEach(() => {
    tenantsService = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<TenantsService>;
    tenantsRepository = {
      updateProvisioningResult: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;
    authServiceClient = {
      seedClinicAdmin: jest.fn(),
    };
    notificationServiceClient = {
      sendAdminInvite: jest.fn(),
    };
    service = new OnboardingService(
      tenantsService,
      tenantsRepository,
      authServiceClient,
      notificationServiceClient,
    );
  });

  it('provisions the tenant, seeds the admin, sends the invite, and persists both outcomes (happy path)', async () => {
    tenantsService.create.mockResolvedValue(activeTenant);
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'succeeded',
    });
    notificationServiceClient.sendAdminInvite.mockResolvedValue({
      outcome: 'succeeded',
    });
    tenantsRepository.updateProvisioningResult.mockResolvedValue({
      ...activeTenant,
      adminSeedStatus: 'succeeded',
      inviteStatus: 'succeeded',
    });

    const result = await service.onboard(dto);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(tenantsService.create).toHaveBeenCalledWith({
      name: 'Acme Inc',
      slug: 'acme',
      plan: 'starter',
      modules: ['clinic'],
      ownerEmail: 'admin@acme.example.com',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(authServiceClient.seedClinicAdmin).toHaveBeenCalledWith(
      'tenant-1',
      'admin@acme.example.com',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationServiceClient.sendAdminInvite).toHaveBeenCalledWith(
      'tenant-1',
      'admin@acme.example.com',
      'Acme Inc',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(tenantsRepository.updateProvisioningResult).toHaveBeenCalledWith(
      'tenant-1',
      { adminSeedStatus: 'succeeded', inviteStatus: 'succeeded' },
    );
    expect(result).toEqual({
      tenant: {
        id: 'tenant-1',
        slug: 'acme',
        name: 'Acme Inc',
        plan: 'starter',
        status: TenantStatus.ACTIVE,
        schemaName: 'tenant_acme',
        adminSeedStatus: 'succeeded',
        inviteStatus: 'succeeded',
        modules: [],
      },
      adminSeed: { status: 'succeeded', message: undefined },
      invite: { status: 'succeeded', message: undefined },
    });
  });

  it('propagates a tenant-creation failure untouched and attempts nothing downstream', async () => {
    tenantsService.create.mockRejectedValue(new Error('slug already exists'));

    await expect(service.onboard(dto)).rejects.toThrow('slug already exists');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(authServiceClient.seedClinicAdmin).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationServiceClient.sendAdminInvite).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(tenantsRepository.updateProvisioningResult).not.toHaveBeenCalled();
  });

  it('skips the invite call and persists adminSeedStatus=failed when admin-seeding fails', async () => {
    tenantsService.create.mockResolvedValue(activeTenant);
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'failed',
      error: 'auth service unreachable',
    });
    tenantsRepository.updateProvisioningResult.mockResolvedValue({
      ...activeTenant,
      adminSeedStatus: 'failed',
      inviteStatus: 'skipped',
    });

    const result = await service.onboard(dto);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationServiceClient.sendAdminInvite).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(tenantsRepository.updateProvisioningResult).toHaveBeenCalledWith(
      'tenant-1',
      { adminSeedStatus: 'failed', inviteStatus: 'skipped' },
    );
    expect(result.adminSeed).toEqual({
      status: 'failed',
      message: 'auth service unreachable',
    });
    expect(result.invite).toEqual({ status: 'skipped', message: undefined });
    // The tenant itself is still reported back as active -- the tenant IS
    // usable, just missing its admin (AC1 still shows it, per the
    // partial-failure policy).
    expect(result.tenant.status).toBe(TenantStatus.ACTIVE);
  });

  it('persists inviteStatus=failed (not skipped) when admin-seeding succeeds but the invite call fails', async () => {
    tenantsService.create.mockResolvedValue(activeTenant);
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'succeeded',
    });
    notificationServiceClient.sendAdminInvite.mockResolvedValue({
      outcome: 'failed',
      error: 'notification service timed out',
    });
    tenantsRepository.updateProvisioningResult.mockResolvedValue({
      ...activeTenant,
      adminSeedStatus: 'succeeded',
      inviteStatus: 'failed',
    });

    const result = await service.onboard(dto);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(tenantsRepository.updateProvisioningResult).toHaveBeenCalledWith(
      'tenant-1',
      { adminSeedStatus: 'succeeded', inviteStatus: 'failed' },
    );
    expect(result.adminSeed).toEqual({
      status: 'succeeded',
      message: undefined,
    });
    expect(result.invite).toEqual({
      status: 'failed',
      message: 'notification service timed out',
    });
  });

  it('falls back to the freshly-created tenant plus in-memory statuses if the persistence update races/returns null', async () => {
    tenantsService.create.mockResolvedValue(activeTenant);
    authServiceClient.seedClinicAdmin.mockResolvedValue({
      outcome: 'succeeded',
    });
    notificationServiceClient.sendAdminInvite.mockResolvedValue({
      outcome: 'succeeded',
    });
    tenantsRepository.updateProvisioningResult.mockResolvedValue(null);

    const result = await service.onboard(dto);

    expect(result.tenant).toEqual({
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      adminSeedStatus: 'succeeded',
      inviteStatus: 'succeeded',
      modules: [],
    });
  });
});
