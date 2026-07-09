import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantsRepository } from '../tenants/tenants.repository';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithTenant } from './request-with-tenant.interface';

function makeContext(request: RequestWithTenant): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  let tenantsRepository: jest.Mocked<TenantsRepository>;
  let guard: TenantGuard;

  beforeEach(() => {
    tenantsRepository = {
      findByIdentifier: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;
    guard = new TenantGuard(tenantsRepository);
  });

  it('rejects requests with no tenant identifier with 401', async () => {
    const request = { headers: {} } as RequestWithTenant;

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(tenantsRepository.findByIdentifier).not.toHaveBeenCalled();
  });

  it('rejects an unknown tenant with 401 (not 404 -- deliberately uniform, see doc comment)', async () => {
    tenantsRepository.findByIdentifier.mockResolvedValue(null);
    const request = {
      headers: { 'x-tenant-id': 'ghost' },
    } as unknown as RequestWithTenant;

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.tenant).toBeUndefined();
  });

  it('rejects an inactive tenant with the same uniform 401 (not 403)', async () => {
    tenantsRepository.findByIdentifier.mockResolvedValue({
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.INACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    });
    const request = {
      headers: { 'x-tenant-id': 'acme' },
    } as unknown as RequestWithTenant;

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.tenant).toBeUndefined();
  });

  it('rejects a pending (not yet provisioned) tenant, same as inactive', async () => {
    tenantsRepository.findByIdentifier.mockResolvedValue({
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.PENDING,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    });
    const request = {
      headers: { 'x-tenant-id': 'acme' },
    } as unknown as RequestWithTenant;

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the resolved active tenant to the request', async () => {
    const tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    };
    tenantsRepository.findByIdentifier.mockResolvedValue(tenant);
    const request = {
      headers: { 'x-tenant-id': 'acme' },
    } as unknown as RequestWithTenant;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.tenant).toEqual(tenant);
  });
});
