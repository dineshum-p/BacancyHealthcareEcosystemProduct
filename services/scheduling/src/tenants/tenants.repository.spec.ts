import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { TenantsRepository } from './tenants.repository';
import { TenantStatus } from './tenant-status.enum';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

describe('TenantsRepository', () => {
  let pool: Pool;
  let repository: TenantsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query(`
      CREATE TABLE public.tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        schema_name TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT '',
        owner_email TEXT
      )
    `);
    repository = new TenantsRepository(pool);
  });

  async function insertTenant(
    overrides: Partial<{
      id: string;
      slug: string;
      status: string;
      schemaName: string;
      plan: string;
    }> = {},
  ): Promise<{ id: string; slug: string; schemaName: string }> {
    const id = overrides.id ?? randomUUID();
    const slug = overrides.slug ?? 'acme';
    const schemaName = overrides.schemaName ?? 'acme';
    const status = overrides.status ?? TenantStatus.ACTIVE;
    const plan = overrides.plan ?? 'starter';
    await pool.query(
      `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan, owner_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, slug, status, schemaName, slug, plan, `owner-${slug}@example.com`],
    );
    return { id, slug, schemaName };
  }

  it('finds a tenant by id', async () => {
    const seeded = await insertTenant();

    const tenant = await repository.findByIdentifier(seeded.id);

    expect(tenant).toMatchObject({
      id: seeded.id,
      slug: seeded.slug,
      schemaName: seeded.schemaName,
      status: TenantStatus.ACTIVE,
    });
  });

  it('finds a tenant by slug', async () => {
    const seeded = await insertTenant({ slug: 'globex' });

    const tenant = await repository.findByIdentifier('globex');

    expect(tenant?.id).toBe(seeded.id);
  });

  it('returns null for an unknown identifier', async () => {
    const tenant = await repository.findByIdentifier('does-not-exist');
    expect(tenant).toBeNull();
  });

  it('findById returns null for an unknown id', async () => {
    const tenant = await repository.findById('does-not-exist');
    expect(tenant).toBeNull();
  });

  it('findById returns the tenant for a known id', async () => {
    const seeded = await insertTenant({ slug: 'initech' });

    const tenant = await repository.findById(seeded.id);

    expect(tenant?.slug).toBe('initech');
  });
});
