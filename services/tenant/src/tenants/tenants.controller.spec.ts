import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantStatus } from './tenant-status.enum';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

describe('TenantsController', () => {
  let service: jest.Mocked<TenantsService>;
  let controller: TenantsController;

  const tenant: Tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<TenantsService>;
    controller = new TenantsController(service);
  });

  it('delegates tenant creation to the service', async () => {
    const dto: CreateTenantDto = {
      name: 'Acme Inc',
      slug: 'acme',
      plan: 'starter',
    };
    service.create.mockResolvedValue(tenant);

    await expect(controller.create(dto)).resolves.toBe(tenant);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates lookup by id to the service', async () => {
    service.findById.mockResolvedValue(tenant);

    await expect(controller.findOne('tenant-1')).resolves.toBe(tenant);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.findById).toHaveBeenCalledWith('tenant-1');
  });
});
