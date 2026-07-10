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
      `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan, owner_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'tenant-1',
        'acme',
        TenantStatus.ACTIVE,
        'tenant_acme',
        'Acme Inc',
        'starter',
        'owner@acme.example.com',
      ],
    );
  });

  it('resolves a tenant by slug, including its owner email', async () => {
    await expect(repository.findByIdentifier('acme')).resolves.toMatchObject({
      id: 'tenant-1',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@acme.example.com',
    });
  });

  it('resolves a tenant by id via findByIdentifier', async () => {
    await expect(
      repository.findByIdentifier('tenant-1'),
    ).resolves.toMatchObject({
      slug: 'acme',
    });
  });

  it('returns null for an unknown identifier', async () => {
    await expect(repository.findByIdentifier('ghost')).resolves.toBeNull();
  });

  it('resolves ownerEmail as null for a pre-owner-email tenant row', async () => {
    await pool.query(
      `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan, owner_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'tenant-2',
        'legacy',
        TenantStatus.ACTIVE,
        'tenant_legacy',
        'Legacy Co',
        'starter',
        null,
      ],
    );

    await expect(repository.findByIdentifier('legacy')).resolves.toMatchObject({
      slug: 'legacy',
      ownerEmail: null,
    });
  });

  describe('findById', () => {
    it('resolves a tenant strictly by id', async () => {
      await expect(repository.findById('tenant-1')).resolves.toMatchObject({
        slug: 'acme',
      });
    });

    it('does NOT match a slug (only an id)', async () => {
      await expect(repository.findById('acme')).resolves.toBeNull();
    });

    it('returns null for an unknown id', async () => {
      await expect(repository.findById('ghost')).resolves.toBeNull();
    });
  });
});
