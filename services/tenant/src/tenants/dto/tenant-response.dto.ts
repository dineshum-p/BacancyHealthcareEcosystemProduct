import { Tenant } from '../tenant.entity';
import { TenantStatus } from '../tenant-status.enum';

/**
 * The public HTTP response shape for `POST /tenants` and `GET /tenants/:id`
 * (BAC-7 review). Deliberately omits `ownerEmail`.
 *
 * Both endpoints are UNAUTHENTICATED (see `TenantsController`'s class-level
 * doc comment), and `ownerEmail` is the bootstrap-admin secret
 * `AuthService.register` (in `services/auth`) uses to decide which
 * registrant gets promoted to `super_admin` for a tenant. If it were ever
 * echoed back here, anyone who knows/guesses a tenant's id or slug could
 * read its `ownerEmail` and then win the bootstrap-admin race with that
 * email -- the exact class of privilege-escalation exploit the `ownerEmail`
 * design was meant to close in the first place, just moved one hop away.
 *
 * `ownerEmail` itself is untouched: it is still stored on `Tenant` / read
 * from `public.tenants` internally by `TenantsRepository` and by
 * `services/auth`'s own read-only mirror -- this DTO only shapes what
 * `TenantsController` puts on the wire.
 */
export interface TenantResponseDto {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: TenantStatus;
  schemaName: string;
}

export function toTenantResponseDto(tenant: Tenant): TenantResponseDto {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status,
    schemaName: tenant.schemaName,
  };
}
