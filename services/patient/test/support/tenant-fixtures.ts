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
}

/**
 * Seeds two active tenants plus one inactive tenant into `public.tenants`
 * and creates each active tenant's (otherwise-empty) Postgres schema --
 * mirroring what `services/tenant`'s provisioning flow would have already
 * done in production before `services/patient` ever sees the tenant.
 * `services/patient` itself never creates schemas (only its own
 * `patients`/`patient_mrn_counters`/`audit_logs` tables inside an existing
 * one).
 */
export async function seedTestTenants(pool: Pool): Promise<SeededTenants> {
  const tenantsRepository = new TenantsRepository(pool);

  const tenantA = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-a',
    schemaName: 'tenant_a',
    status: TenantStatus.ACTIVE,
  });
  const tenantB = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-b',
    schemaName: 'tenant_b',
    status: TenantStatus.ACTIVE,
  });
  const inactiveTenant = await insertTenant(pool, tenantsRepository, {
    slug: 'tenant-inactive',
    schemaName: 'tenant_inactive',
    status: TenantStatus.INACTIVE,
  });

  await pool.query(
    `CREATE SCHEMA ${quoteSchemaIdentifier(tenantA.schemaName)}`,
  );
  await pool.query(
    `CREATE SCHEMA ${quoteSchemaIdentifier(tenantB.schemaName)}`,
  );
  // Deliberately NOT creating a schema for the inactive tenant: TenantGuard
  // must reject it before any schema-scoped query ever runs.

  return { tenantA, tenantB, inactiveTenant };
}

async function insertTenant(
  pool: Pool,
  tenantsRepository: TenantsRepository,
  fields: Pick<Tenant, 'slug' | 'schemaName' | 'status'>,
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
      `owner-${fields.slug}@example.com`,
    ],
  );
  const tenant = await tenantsRepository.findByIdentifier(fields.slug);
  if (!tenant) {
    throw new Error(`Failed to seed tenant "${fields.slug}"`);
  }
  return tenant;
}
