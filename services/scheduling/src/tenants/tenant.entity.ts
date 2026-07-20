import { TenantStatus } from './tenant-status.enum';

/**
 * A row in the shared/public `tenants` registry table, as seen read-only
 * from `services/scheduling`. `services/tenant` owns writes to this table
 * (BAC-3); this service only ever resolves a tenant by identifier to enforce
 * tenant scoping (reject unknown/inactive tenants) and to know which schema
 * to bind appointment queries to.
 */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: TenantStatus;
  schemaName: string;
  ownerEmail: string | null;
}
