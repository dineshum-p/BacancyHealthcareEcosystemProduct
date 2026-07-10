import { TenantStatus } from './tenant-status.enum';

/**
 * A row in the shared/public `tenants` registry table, as seen read-only
 * from `services/notification`. `services/tenant` owns writes to this table
 * (BAC-3); this service only ever resolves a tenant by identifier to decide
 * which schema to bind `notifications` queries to.
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
