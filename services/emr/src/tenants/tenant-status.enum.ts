/**
 * Mirrors `services/tenant`'s `TenantStatus` (BAC-3/BAC-4). Duplicated here
 * rather than imported: `services/emr` is an independently deployable
 * NestJS app with its own `package.json`, so it cannot import TypeScript
 * from `services/tenant` -- it only shares the same underlying Postgres
 * cluster/`public.tenants` registry, read-only, at the SQL level (same
 * approach `services/auth`/`services/notification` take).
 */
export enum TenantStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
