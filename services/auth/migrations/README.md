# Migrations

This directory is intentionally empty.

`services/auth` does not own any statically-migrated schema:

- `public.tenants` (the shared tenant registry) is owned and migrated by
  `services/tenant` (BAC-3). This service only ever reads it
  (`src/tenants/tenants.repository.ts`).
- This service's own domain tables -- `<tenant_schema>.users`,
  `<tenant_schema>.refresh_tokens`, and (BAC-6) `<tenant_schema>.
  mfa_recovery_codes` -- live inside each tenant's dynamically provisioned
  Postgres schema, one per tenant, and can't be expressed as a single
  static migration. They are created lazily and idempotently by
  `AuthSchemaProvisioner` (`src/auth/auth-schema.provisioner.ts`) the first
  time this process needs them for a given tenant, the same way
  `services/tenant`'s `TenantSchemaProvisioner` creates its sample `items`
  table -- see that service's `migrations/` for the one table that *is*
  statically migrated (`public.tenants`) for comparison.
- BAC-6 added `mfa_status`, `mfa_secret_encrypted`, and `mfa_last_used_step`
  columns to `users`. Since a tenant's schema may have already been
  provisioned by an older version of this service (before those columns
  existed), `AuthSchemaProvisioner` also runs an idempotent
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each one on every call --
  the closest equivalent to a real migration this dynamic-per-tenant
  provisioning model supports.

The `migrate:up` / `migrate:down` npm scripts and `node-pg-migrate` devDependency
are kept for scaffold consistency with `services/tenant` and so a future
ticket that needs a real static migration (e.g. a `public`-schema table
owned by this service) has somewhere to put it without re-plumbing anything.
