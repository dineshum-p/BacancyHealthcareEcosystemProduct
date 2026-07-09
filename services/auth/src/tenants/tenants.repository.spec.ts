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

    await pool.query(
      `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'tenant-1',
        'acme',
        TenantStatus.ACTIVE,
        'tenant_acme',
        'Acme Inc',
        'starter',
      ],
    );
  });

  it('resolves a tenant by slug', async () => {
    await expect(repository.findByIdentifier('acme')).resolves.toMatchObject({
      id: 'tenant-1',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
    });
  });

  it('resolves a tenant by id', async () => {
    await expect(
      repository.findByIdentifier('tenant-1'),
    ).resolves.toMatchObject({
      slug: 'acme',
    });
  });

  it('returns null for an unknown identifier', async () => {
    await expect(repository.findByIdentifier('ghost')).resolves.toBeNull();
  });
});
