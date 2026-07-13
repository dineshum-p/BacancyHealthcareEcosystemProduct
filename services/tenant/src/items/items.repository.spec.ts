import { Pool, PoolClient } from 'pg';
import { ItemsRepository } from './items.repository';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';
import { Tenant } from '../tenants/tenant.entity';

function makeFakeTenantContext(
  pool: Pool,
  tenant: Tenant,
): TenantContextService {
  let client: PoolClient | null = null;
  return {
    getTenant: () => tenant,
    getSchemaBoundClient: async () => {
      if (!client) {
        client = await pool.connect();
        await client.query(`SET search_path TO "${tenant.schemaName}", public`);
      }
      return client;
    },
  } as unknown as TenantContextService;
}

describe('ItemsRepository', () => {
  let pool: Pool;
  const tenant: Tenant = {
    id: '1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@acme.example.com',
    adminSeedStatus: null,
    inviteStatus: null,
  };

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA "tenant_acme"');
    await pool.query(
      'CREATE TABLE "tenant_acme".items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
  });

  it('starts empty', async () => {
    const repository = new ItemsRepository(makeFakeTenantContext(pool, tenant));
    await expect(repository.findAll()).resolves.toEqual([]);
  });

  it('creates and lists items scoped to the tenant schema', async () => {
    const repository = new ItemsRepository(makeFakeTenantContext(pool, tenant));

    const created = await repository.create('widget');
    expect(created).toMatchObject({ name: 'widget' });

    const all = await repository.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: created.id, name: 'widget' });
  });
});
