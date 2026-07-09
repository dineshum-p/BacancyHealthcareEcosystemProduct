import { TenantStatus } from './tenant-status.enum';

/**
 * A row in the shared/public `tenants` registry table, as seen read-only
 * from `services/auth`. `services/tenant` owns writes to this table (BAC-3);
 * this service only ever resolves a tenant by identifier (BAC-4-style) to
 * decide which schema to bind `users`/`refresh_tokens` queries to.
 */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: TenantStatus;
  schemaName: string;
  /**
   * BAC-7: the single email address permitted to bootstrap this tenant's
   * `super_admin` (see `AuthService.register`'s doc comment). `null` for
   * tenants that predate this column (`services/tenant`'s
   * `1752105600000_add-tenant-owner-email` migration) -- such a tenant
   * simply has no bootstrap-eligible owner going forward.
   */
  ownerEmail: string | null;
}
