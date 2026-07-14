import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { TenantsService } from '../tenants/tenants.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { Tenant } from '../tenants/tenant.entity';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import type { OnboardTenantResponse } from '@hep/shared-types';

describe('OnboardingController', () => {
  let tenantsService: jest.Mocked<TenantsService>;
  let onboardingService: jest.Mocked<OnboardingService>;
  let controller: OnboardingController;

  const tenant: Tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@acme.example.com',
    adminSeedStatus: 'succeeded',
    inviteStatus: 'succeeded',
  };

  beforeEach(() => {
    tenantsService = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<TenantsService>;
    onboardingService = {
      onboard: jest.fn(),
    } as unknown as jest.Mocked<OnboardingService>;
    controller = new OnboardingController(tenantsService, onboardingService);
  });

  describe('list', () => {
    it('returns every tenant mapped through the public response DTO (AC3)', async () => {
      tenantsService.findAll.mockResolvedValue([tenant]);

      const result = await controller.list();

      expect(result).toEqual([
        {
          id: 'tenant-1',
          slug: 'acme',
          name: 'Acme Inc',
          plan: 'starter',
          status: TenantStatus.ACTIVE,
          schemaName: 'tenant_acme',
          adminSeedStatus: 'succeeded',
          inviteStatus: 'succeeded',
        },
      ]);
    });

    it('never includes ownerEmail in the list response (BAC-7 review)', async () => {
      tenantsService.findAll.mockResolvedValue([tenant]);

      const result = await controller.list();

      expect(result[0]).not.toHaveProperty('ownerEmail');
    });
  });

  describe('onboard', () => {
    it('delegates to OnboardingService (AC1/AC2)', async () => {
      const dto: OnboardTenantDto = {
        name: 'Acme Inc',
        slug: 'acme',
        plan: 'starter',
        adminEmail: 'admin@acme.example.com',
      };
      const response: OnboardTenantResponse = {
        tenant: {
          id: 'tenant-1',
          slug: 'acme',
          name: 'Acme Inc',
          plan: 'starter',
          status: 'active',
          schemaName: 'tenant_acme',
          adminSeedStatus: 'succeeded',
          inviteStatus: 'succeeded',
        },
        adminSeed: { status: 'succeeded' },
        invite: { status: 'succeeded' },
      };
      onboardingService.onboard.mockResolvedValue(response);

      await expect(controller.onboard(dto)).resolves.toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(onboardingService.onboard).toHaveBeenCalledWith(dto);
    });
  });
});
