import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { TenantsRepository } from '../../src/tenants/tenants.repository';
import { TenantSchemaProvisioner } from '../../src/tenants/provisioning/tenant-schema-provisioner';
import { TenantStatus } from '../../src/tenants/tenant-status.enum';
import { Tenant } from '../../src/tenants/tenant.entity';
import { quoteSchemaIdentifier } from '../../src/tenants/schema-identifier.util';

export interface SeededTenants {
  tenantA: Tenant;
  tenantB: Tenant;
  inactiveTenant: Tenant;
}

/**
 * Seeds two active tenants (each with their own isolated schema and one
 * sample `items` row) plus one inactive tenant, using the same production
 * `TenantsRepository` / `TenantSchemaProvisioner` code paths the app uses at
 * runtime. This is the BAC-3 scaffolding BAC-4's tests need: real,
 * separately-schema'd tenants to prove cross-tenant isolation against.
 */
export async function seedTestTenants(pool: Pool): Promise<SeededTenants> {
  const tenantsRepository = new TenantsRepository(pool);
  const provisioner = new TenantSchemaProvisioner(pool);

  const tenantA = await tenantsRepository.create({
    id: randomUUID(),
    slug: 'tenant-a',
    name: 'Tenant A',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_a',
    ownerEmail: 'owner-a@example.com',
    adminSeedStatus: null,
    inviteStatus: null,
  });
  const tenantB = await tenantsRepository.create({
    id: randomUUID(),
    slug: 'tenant-b',
    name: 'Tenant B',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_b',
    ownerEmail: 'owner-b@example.com',
    adminSeedStatus: null,
    inviteStatus: null,
  });
  const inactiveTenant = await tenantsRepository.create({
    id: randomUUID(),
    slug: 'tenant-inactive',
    name: 'Tenant Inactive',
    plan: 'starter',
    status: TenantStatus.INACTIVE,
    schemaName: 'tenant_inactive',
    ownerEmail: 'owner-inactive@example.com',
    adminSeedStatus: null,
    inviteStatus: null,
  });

  await provisioner.provision(tenantA.schemaName);
  await provisioner.provision(tenantB.schemaName);
  await provisioner.provision(inactiveTenant.schemaName);

  await pool.query(
    `INSERT INTO ${quoteSchemaIdentifier(tenantA.schemaName)}.items (name) VALUES ($1)`,
    ['tenant-a seed item'],
  );
  await pool.query(
    `INSERT INTO ${quoteSchemaIdentifier(tenantB.schemaName)}.items (name) VALUES ($1)`,
    ['tenant-b seed item'],
  );

  return { tenantA, tenantB, inactiveTenant };
}
