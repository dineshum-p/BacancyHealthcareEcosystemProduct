import { TenantContextController } from './tenant-context.controller';
import { TenantContextService } from './tenant-context.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import type { Tenant } from '../tenants/tenant.entity';

describe('TenantContextController', () => {
  const tenant: Tenant = {
    id: '1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@acme.example.com',
  };

  const buildController = (): TenantContextController => {
    const service = {
      getTenant: jest.fn().mockReturnValue(tenant),
    } as unknown as TenantContextService;
    return new TenantContextController(service);
  };

  it('returns the public (filtered) shape of the tenant exposed by TenantContextService', () => {
    const controller = buildController();

    expect(controller.getCurrentTenant()).toEqual({
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    });
  });

  it('never includes ownerEmail in the GET /tenant-context/me response (BAC-7 review, 3rd leak point)', () => {
    const controller = buildController();

    const response = controller.getCurrentTenant();

    expect(response).not.toHaveProperty('ownerEmail');
  });
});
