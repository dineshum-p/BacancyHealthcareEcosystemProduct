import { TenantContextController } from './tenant-context.controller';
import { TenantContextService } from './tenant-context.service';
import { TenantStatus } from '../tenants/tenant-status.enum';

describe('TenantContextController', () => {
  it('returns the tenant exposed by TenantContextService', () => {
    const tenant = {
      id: '1',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    };
    const service = {
      getTenant: jest.fn().mockReturnValue(tenant),
    } as unknown as TenantContextService;
    const controller = new TenantContextController(service);

    expect(controller.getCurrentTenant()).toBe(tenant);
  });
});
