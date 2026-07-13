import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './tenants.repository';
import { TenantSchemaProvisioner } from './provisioning/tenant-schema-provisioner';
import { TenantStatus } from './tenant-status.enum';
import { SlugAlreadyExistsError } from './errors/slug-already-exists.error';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './tenant.entity';

describe('TenantsService', () => {
  let tenantsRepository: jest.Mocked<TenantsRepository>;
  let schemaProvisioner: jest.Mocked<TenantSchemaProvisioner>;
  let service: TenantsService;

  const dto: CreateTenantDto = {
    name: 'Acme Inc',
    slug: 'acme',
    plan: 'starter',
    ownerEmail: 'owner@acme.example.com',
  };

  const pendingTenant: Tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.PENDING,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@acme.example.com',
    adminSeedStatus: null,
    inviteStatus: null,
  };

  beforeEach(() => {
    tenantsRepository = {
      findByIdentifier: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      updateProvisioningResult: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;
    schemaProvisioner = {
      provision: jest.fn(),
    } as unknown as jest.Mocked<TenantSchemaProvisioner>;
    service = new TenantsService(tenantsRepository, schemaProvisioner);
  });

  describe('create', () => {
    it('creates the tenant as pending, provisions its schema, then activates it', async () => {
      tenantsRepository.create.mockResolvedValue(pendingTenant);
      schemaProvisioner.provision.mockResolvedValue(undefined);
      const activeTenant: Tenant = {
        ...pendingTenant,
        status: TenantStatus.ACTIVE,
      };
      tenantsRepository.updateStatus.mockResolvedValue(activeTenant);

      const result = await service.create(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock, `this` binding is irrelevant
      expect(tenantsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'acme',
          name: 'Acme Inc',
          plan: 'starter',
          status: TenantStatus.PENDING,
          schemaName: 'tenant_acme',
          ownerEmail: 'owner@acme.example.com',
          adminSeedStatus: null,
          inviteStatus: null,
        }),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock, `this` binding is irrelevant
      expect(schemaProvisioner.provision).toHaveBeenCalledWith('tenant_acme');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock, `this` binding is irrelevant
      expect(tenantsRepository.updateStatus).toHaveBeenCalledWith(
        pendingTenant.id,
        TenantStatus.ACTIVE,
      );
      expect(result).toEqual(activeTenant);
    });

    it('assigns each tenant a unique generated id', async () => {
      tenantsRepository.create.mockImplementation((tenant) =>
        Promise.resolve(tenant),
      );
      schemaProvisioner.provision.mockResolvedValue(undefined);
      tenantsRepository.updateStatus.mockImplementation((id, status) =>
        Promise.resolve({ ...pendingTenant, id, status }),
      );

      await service.create(dto);
      await service.create(dto);

      const [firstCallArg] = tenantsRepository.create.mock.calls[0];
      const [secondCallArg] = tenantsRepository.create.mock.calls[1];
      expect(firstCallArg.id).toEqual(expect.any(String));
      expect(firstCallArg.id).not.toBe(secondCallArg.id);
    });

    it('translates a duplicate slug into a ConflictException (409)', async () => {
      tenantsRepository.create.mockRejectedValue(
        new SlugAlreadyExistsError('acme'),
      );

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.provision).not.toHaveBeenCalled();
    });

    it('leaves the tenant pending (rather than activating it) when provisioning fails', async () => {
      tenantsRepository.create.mockResolvedValue(pendingTenant);
      schemaProvisioner.provision.mockRejectedValue(
        new Error('provisioning boom'),
      );

      await expect(service.create(dto)).rejects.toThrow('provisioning boom');

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(tenantsRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('propagates unrelated repository errors unchanged', async () => {
      tenantsRepository.create.mockRejectedValue(new Error('db unreachable'));

      await expect(service.create(dto)).rejects.toThrow('db unreachable');
    });
  });

  describe('findById', () => {
    it('returns the tenant when found', async () => {
      tenantsRepository.findById.mockResolvedValue(pendingTenant);

      await expect(service.findById('tenant-1')).resolves.toEqual(
        pendingTenant,
      );
    });

    it('throws NotFoundException when the tenant does not exist', async () => {
      tenantsRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('delegates to the repository (BAC-12, AC3)', async () => {
      tenantsRepository.findAll.mockResolvedValue([pendingTenant]);

      await expect(service.findAll()).resolves.toEqual([pendingTenant]);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(tenantsRepository.findAll).toHaveBeenCalledWith();
    });
  });
});
