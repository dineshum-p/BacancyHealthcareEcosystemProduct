import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { TenantsRepository } from '../../src/tenants/tenants.repository';
import { TenantStatus } from '../../src/tenants/tenant-status.enum';
import { Tenant } from '../../src/tenants/tenant.entity';
import { quoteSchemaIdentifier } from '../../src/tenants/schema-identifier.util';

export interface SeededTenants {
  tenantA: Tenant;
  tenantB: Tenant;
  inactiveTenant: Tenant;
  /**
   * A tenant used exclusively by BAC-7's RBAC e2e tests, so their
   * bootstrap-admin assertions (which depend on being the FIRST-EVER
   * registration against a tenant's schema) are self-contained and don't
   * depend on execution order relative to `tenantA`/`tenantB`'s other uses
   * elsewhere in the same spec file.
   */
  rbacTenant: Tenant;
}

/**
 * Seeds two active tenants plus one inactive tenant into `public.tenants`
 * and creates each active tenant's (otherwise-empty) Postgres schema --
 * mirroring what `services/tenant`'s provisioning flow (BAC-3) would have
 * already done in production before `services/auth` ever sees the tenant.
 * `services/auth` itself never creates schemas (only its own `users` /
 * `refresh_tokens` tables inside an existing one -- see
 * `AuthSchemaProvisioner`).
 */
export async function seedTestTenants(pool: Pool): Promise<SeededTenants> {
  const tenantsRepository = new TenantsRepository(pool);

  const tenantA = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-a',
    schemaName: 'tenant_a',
    status: TenantStatus.ACTIVE,
    ownerEmail: 'owner-a@example.com',
  });
  const tenantB = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-b',
    schemaName: 'tenant_b',
    status: TenantStatus.ACTIVE,
    ownerEmail: 'owner-b@example.com',
  });
  const inactiveTenant = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-inactive',
    schemaName: 'tenant_inactive',
    status: TenantStatus.INACTIVE,
    ownerEmail: 'owner-inactive@example.com',
  });
  const rbacTenant = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-rbac',
    schemaName: 'tenant_rbac',
    status: TenantStatus.ACTIVE,
    ownerEmail: 'owner-rbac@example.com',
  });

  await pool.query(
    `CREATE SCHEMA ${quoteSchemaIdentifier(tenantA.schemaName)}`,
  );
  await pool.query(
    `CREATE SCHEMA ${quoteSchemaIdentifier(tenantB.schemaName)}`,
  );
  await pool.query(
    `CREATE SCHEMA ${quoteSchemaIdentifier(rbacTenant.schemaName)}`,
  );
  // Deliberately NOT creating a schema for the inactive tenant: TenantGuard
  // must reject it before any schema-scoped query ever runs.

  return { tenantA, tenantB, inactiveTenant, rbacTenant };
}

async function insertTenant(
  pool: Pool,
  tenantsRepository: TenantsRepository,
  fields: Pick<Tenant, 'slug' | 'schemaName' | 'status' | 'ownerEmail'>,
): Promise<Tenant> {
  await pool.query(
    `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan, owner_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      fields.slug,
      fields.status,
      fields.schemaName,
      fields.slug,
      'starter',
      fields.ownerEmail,
    ],
  );
  const tenant = await tenantsRepository.findByIdentifier(fields.slug);
  if (!tenant) {
    throw new Error(`Failed to seed tenant "${fields.slug}"`);
  }
  return tenant;
}

/**
 * Creates one additional active tenant (with its own schema) beyond the
 * fixed set `seedTestTenants` returns, for BAC-7 tests that need a
 * dedicated, per-test `ownerEmail` (e.g. proving the bootstrap-exploit is
 * closed for a brand-new tenant, or that concurrent non-owner registrations
 * both land as `staff`) without disturbing `rbacTenant`'s own
 * already-registered owner.
 */
export async function createAdditionalTenant(
  pool: Pool,
  fields: { slug: string; ownerEmail: string },
): Promise<Tenant> {
  const tenantsRepository = new TenantsRepository(pool);
  const schemaName = fields.slug.replace(/-/g, '_');
  const tenant = await insertTenant(pool, tenantsRepository, {
    slug: fields.slug,
    schemaName,
    status: TenantStatus.ACTIVE,
    ownerEmail: fields.ownerEmail,
  });
  await pool.query(`CREATE SCHEMA ${quoteSchemaIdentifier(schemaName)}`);
  return tenant;
}
