import { Pool } from 'pg';
import { TenantsRepository } from './tenants.repository';
import { TenantStatus } from './tenant-status.enum';
import { SlugAlreadyExistsError } from './errors/slug-already-exists.error';
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
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@acme.example.com',
    });
    expect(created.slug).toBe('acme');
    expect(created.name).toBe('Acme Inc');
    expect(created.plan).toBe('starter');
    expect(created.ownerEmail).toBe('owner@acme.example.com');

    await expect(repository.findByIdentifier('acme')).resolves.toEqual(created);
  });

  it('finds a tenant by id', async () => {
    const created = await repository.create({
      id: 'tenant-2',
      slug: 'beta',
      name: 'Beta Co',
      plan: 'pro',
      status: TenantStatus.INACTIVE,
      schemaName: 'tenant_beta',
      ownerEmail: 'owner@beta.example.com',
    });

    await expect(repository.findByIdentifier('tenant-2')).resolves.toEqual(
      created,
    );
  });

  it('persists a null owner_email for a tenant created without one (pre-BAC-7 rows)', async () => {
    const created = await repository.create({
      id: 'tenant-legacy',
      slug: 'legacy',
      name: 'Legacy Co',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_legacy',
      ownerEmail: null,
    });

    expect(created.ownerEmail).toBeNull();
    await expect(repository.findByIdentifier('legacy')).resolves.toEqual(
      created,
    );
  });

  it('refuses to persist a tenant with an unsafe schema name', async () => {
    await expect(
      repository.create({
        id: 'tenant-3',
        slug: 'evil',
        name: 'Evil Corp',
        plan: 'starter',
        status: TenantStatus.ACTIVE,
        schemaName: 'bad; drop table x;',
        ownerEmail: 'owner@evil.example.com',
      }),
    ).rejects.toThrow(/unsafe schema name/i);

    await expect(repository.findByIdentifier('evil')).resolves.toBeNull();
  });

  describe('findById', () => {
    it('returns null when no tenant matches the id', async () => {
      await expect(repository.findById('missing')).resolves.toBeNull();
    });

    it('returns the tenant matching the id (not a slug match)', async () => {
      const created = await repository.create({
        id: 'tenant-4',
        slug: 'gamma',
        name: 'Gamma LLC',
        plan: 'starter',
        status: TenantStatus.PENDING,
        schemaName: 'tenant_gamma',
        ownerEmail: 'owner@gamma.example.com',
      });

      await expect(repository.findById('tenant-4')).resolves.toEqual(created);
      // Passing the slug (not the id) must NOT match `findById`.
      await expect(repository.findById('gamma')).resolves.toBeNull();
    });
  });

  describe('create with a duplicate slug', () => {
    it('throws SlugAlreadyExistsError instead of a raw Postgres error', async () => {
      await repository.create({
        id: 'tenant-5',
        slug: 'dup',
        name: 'First',
        plan: 'starter',
        status: TenantStatus.PENDING,
        schemaName: 'tenant_dup_1',
        ownerEmail: 'owner-first@example.com',
      });

      await expect(
        repository.create({
          id: 'tenant-6',
          slug: 'dup',
          name: 'Second',
          plan: 'starter',
          status: TenantStatus.PENDING,
          schemaName: 'tenant_dup_2',
          ownerEmail: 'owner-second@example.com',
        }),
      ).rejects.toThrow(SlugAlreadyExistsError);
    });
  });

  describe('updateStatus', () => {
    it('updates and returns the tenant with the new status', async () => {
      const created = await repository.create({
        id: 'tenant-7',
        slug: 'delta',
        name: 'Delta Inc',
        plan: 'starter',
        status: TenantStatus.PENDING,
        schemaName: 'tenant_delta',
        ownerEmail: 'owner@delta.example.com',
      });

      const updated = await repository.updateStatus(
        created.id,
        TenantStatus.ACTIVE,
      );

      expect(updated).toEqual({ ...created, status: TenantStatus.ACTIVE });
      await expect(repository.findById(created.id)).resolves.toEqual(updated);
    });

    it('returns null when the tenant does not exist', async () => {
      await expect(
        repository.updateStatus('missing', TenantStatus.ACTIVE),
      ).resolves.toBeNull();
    });
  });
});
