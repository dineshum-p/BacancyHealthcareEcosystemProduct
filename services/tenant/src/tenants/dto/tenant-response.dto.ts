import { Tenant } from '../tenant.entity';
import { TenantStatus } from '../tenant-status.enum';

/**
 * The single source of truth for "what's safe to put on the wire" for any
 * HTTP response that returns a `Tenant`. Deliberately omits `ownerEmail`.
 *
 * Used by every controller in this service that can return tenant data --
 * currently `POST /tenants`, `GET /tenants/:id` (both `TenantsController`,
 * unauthenticated by design -- see its class-level doc comment) and
 * `GET /tenant-context/me` (`TenantContextController`, guarded only by
 * `TenantGuard`, which resolves a tenant from `X-Tenant-Id`/subdomain and
 * does NOT check user identity -- so it is effectively unauthenticated too).
 *
 * `ownerEmail` is the bootstrap-admin secret `AuthService.register` (in
 * `services/auth`) uses to decide which registrant gets promoted to
 * `super_admin` for a tenant. If it were ever echoed back on any of these
 * routes, anyone who knows/guesses a tenant's id or slug could read its
 * `ownerEmail` and then win the bootstrap-admin race with that email -- the
 * exact class of privilege-escalation exploit the `ownerEmail` design was
 * meant to close in the first place, just moved one hop away. This has
 * already been the root cause of three separate review findings (BAC-7)
 * across three different endpoints -- always fix new tenant-returning
 * response paths by mapping through THIS function, not a bespoke filter.
 *
 * `ownerEmail` itself is untouched: it is still stored on `Tenant` / read
 * from `public.tenants` internally by `TenantsRepository` and by
 * `services/auth`'s own read-only mirror -- this DTO only shapes what
 * controllers put on the wire.
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
