import { EventEmitter } from 'node:events';
import { Pool, PoolClient } from 'pg';
import { TenantContextService } from './tenant-context.service';
import { RequestWithTenant } from './request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

function mockConnectOnce(target: Pool, client: PoolClient): void {
  const spy = jest.spyOn(target, 'connect') as unknown as jest.SpyInstance<
    Promise<PoolClient>,
    []
  >;
  spy.mockImplementationOnce(() => Promise.resolve(client));
}

function mockQueryRejectionOnce(client: PoolClient, error: Error): void {
  const spy = jest.spyOn(client, 'query') as unknown as jest.SpyInstance<
    Promise<never>,
    unknown[]
  >;
  spy.mockImplementationOnce(() => Promise.reject(error));
}

function makeRequest(): RequestWithTenant {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    headers: {},
  }) as unknown as RequestWithTenant;
}

describe('TenantContextService', () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createInMemoryPool();
  });

  it('throws when no tenant has been resolved on the request', () => {
    const request = makeRequest();
    const service = new TenantContextService(request, pool);

    expect(() => service.getTenant()).toThrow(/TenantGuard/);
  });

  it('returns the tenant attached by TenantGuard', () => {
    const request = makeRequest();
    request.tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    };
    const service = new TenantContextService(request, pool);

    expect(service.getTenant()).toEqual(request.tenant);
  });

  it('binds a schema-scoped client and caches it for the request', async () => {
    const request = makeRequest();
    request.tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    };
    const service = new TenantContextService(request, pool);

    const client = await service.getSchemaBoundClient();
    const again = await service.getSchemaBoundClient();

    expect(again).toBe(client);
  });

  it('releases the bound client back to the pool when the request closes', async () => {
    const request = makeRequest();
    request.tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    };
    const service = new TenantContextService(request, pool);

    const client = await service.getSchemaBoundClient();
    const releaseSpy = jest.spyOn(client, 'release');

    request.emit('close');

    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe schema names rather than binding a client', async () => {
    const request = makeRequest();
    request.tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'bad; drop table x;',
    };
    const service = new TenantContextService(request, pool);

    await expect(service.getSchemaBoundClient()).rejects.toThrow();
  });

  it('releases the checked-out client back to the pool when schema validation fails', async () => {
    const request = makeRequest();
    request.tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'bad; drop table x;',
    };
    const service = new TenantContextService(request, pool);

    const realClient = await pool.connect();
    realClient.release();
    const releaseSpy = jest.spyOn(realClient, 'release');
    mockConnectOnce(pool, realClient);

    await expect(service.getSchemaBoundClient()).rejects.toThrow();

    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });

  it('releases the checked-out client back to the pool when SET search_path fails', async () => {
    const request = makeRequest();
    request.tenant = {
      id: '1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    };
    const service = new TenantContextService(request, pool);

    const realClient: PoolClient = await pool.connect();
    realClient.release();
    const releaseSpy = jest.spyOn(realClient, 'release');
    mockQueryRejectionOnce(realClient, new Error('SET search_path failed'));
    mockConnectOnce(pool, realClient);

    await expect(service.getSchemaBoundClient()).rejects.toThrow(
      'SET search_path failed',
    );

    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });
});
