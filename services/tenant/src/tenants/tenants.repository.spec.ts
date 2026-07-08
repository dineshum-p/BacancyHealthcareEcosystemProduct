import { Pool } from 'pg';
import { TenantsRepository } from './tenants.repository';
import { TenantStatus } from './tenant-status.enum';
import {
  createInMemoryPool,
  createTenantsTable,
} from '../../test/support/create-in-memory-pool';

describe('TenantsRepository', () => {
  let pool: Pool;
  let repository: TenantsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await createTenantsTable(pool);
    repository = new TenantsRepository(pool);
  });

  it('returns null when no tenant matches the identifier', async () => {
    await expect(repository.findByIdentifier('missing')).resolves.toBeNull();
  });

  it('creates a tenant and finds it by slug', async () => {
    const created = await repository.create({
      id: 'tenant-1',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    });
    expect(created.slug).toBe('acme');

    await expect(repository.findByIdentifier('acme')).resolves.toEqual(created);
  });

  it('finds a tenant by id', async () => {
    const created = await repository.create({
      id: 'tenant-2',
      slug: 'beta',
      status: TenantStatus.INACTIVE,
      schemaName: 'tenant_beta',
    });

    await expect(repository.findByIdentifier('tenant-2')).resolves.toEqual(
      created,
    );
  });

  it('refuses to persist a tenant with an unsafe schema name', async () => {
    await expect(
      repository.create({
        id: 'tenant-3',
        slug: 'evil',
        status: TenantStatus.ACTIVE,
        schemaName: 'bad; drop table x;',
      }),
    ).rejects.toThrow(/unsafe schema name/i);

    await expect(repository.findByIdentifier('evil')).resolves.toBeNull();
  });
});
