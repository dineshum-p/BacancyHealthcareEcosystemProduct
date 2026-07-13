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
    ownerEmail: 'owner@acme.example.com',
    adminSeedStatus: null,
    inviteStatus: null,
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<TenantsService>;
    controller = new TenantsController(service);
  });

  const publicTenantShape = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    adminSeedStatus: null,
    inviteStatus: null,
  };

  it('delegates tenant creation to the service', async () => {
    const dto: CreateTenantDto = {
      name: 'Acme Inc',
      slug: 'acme',
      plan: 'starter',
      ownerEmail: 'owner@acme.example.com',
    };
    service.create.mockResolvedValue(tenant);

    await expect(controller.create(dto)).resolves.toEqual(publicTenantShape);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('never includes ownerEmail in the create response (BAC-7 review)', async () => {
    const dto: CreateTenantDto = {
      name: 'Acme Inc',
      slug: 'acme',
      plan: 'starter',
      ownerEmail: 'owner@acme.example.com',
    };
    service.create.mockResolvedValue(tenant);

    const response = await controller.create(dto);

    expect(response).not.toHaveProperty('ownerEmail');
  });

  it('delegates lookup by id to the service', async () => {
    service.findById.mockResolvedValue(tenant);

    await expect(controller.findOne('tenant-1')).resolves.toEqual(
      publicTenantShape,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.findById).toHaveBeenCalledWith('tenant-1');
  });

  it('never includes ownerEmail in the findOne response (BAC-7 review)', async () => {
    service.findById.mockResolvedValue(tenant);

    const response = await controller.findOne('tenant-1');

    expect(response).not.toHaveProperty('ownerEmail');
  });
});
