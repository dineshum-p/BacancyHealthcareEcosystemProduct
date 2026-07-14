import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantsRepository } from '../tenants/tenants.repository';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithTenant } from './request-with-tenant.interface';

function makeContext(request: Partial<RequestWithTenant>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  function makeGuard(
    findByIdentifier: TenantsRepository['findByIdentifier'],
  ): TenantGuard {
    const repository = { findByIdentifier } as unknown as TenantsRepository;
    return new TenantGuard(repository);
  }

  it('throws 404 when no tenant identifier is supplied', async () => {
    const guard = makeGuard(jest.fn());
    const context = makeContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('throws 404 for an unknown tenant', async () => {
    const guard = makeGuard(jest.fn().mockResolvedValue(null));
    const context = makeContext({ headers: { 'x-tenant-id': 'ghost' } });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('throws 403 for an inactive tenant', async () => {
    const guard = makeGuard(
      jest.fn().mockResolvedValue({
        id: 't1',
        slug: 'acme',
        status: TenantStatus.INACTIVE,
        schemaName: 'acme',
        name: 'Acme',
        plan: 'starter',
        ownerEmail: null,
      }),
    );
    const context = makeContext({ headers: { 'x-tenant-id': 'acme' } });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('resolves and attaches the tenant, returning true for an active tenant', async () => {
    const tenant = {
      id: 't1',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      schemaName: 'acme',
      name: 'Acme',
      plan: 'starter',
      ownerEmail: null,
    };
    const guard = makeGuard(jest.fn().mockResolvedValue(tenant));
    const request: Partial<RequestWithTenant> = {
      headers: { 'x-tenant-id': 'acme' },
    };
    const context = makeContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.tenant).toEqual(tenant);
  });
});
