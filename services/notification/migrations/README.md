# Migrations

This directory is intentionally empty, for the same reason `services/auth`'s
is (see that service's `migrations/README.md`):

- `public.tenants` (the shared tenant registry) is owned and migrated by
  `services/tenant` (BAC-3/BAC-4). This service only ever reads it
  (`src/tenants/tenants.repository.ts`) -- it never provisions or mutates a
  tenant.
- This service's own domain table, `<tenant_schema>.notifications`, lives
  inside each tenant's dynamically provisioned Postgres schema, one per
  tenant, and can't be expressed as a single static migration. It is created
  lazily and idempotently by `NotificationsSchemaProvisioner`
  (`src/notifications/notifications-schema.provisioner.ts`) the first time
  this process needs it for a given tenant -- the same pattern
  `AuthSchemaProvisioner` uses in `services/auth`.

The `migrate:up` / `migrate:down` npm scripts and `node-pg-migrate`
devDependency are kept for scaffold consistency with `services/tenant` /
`services/auth`, and so a future ticket that needs a real static migration
(e.g. a `public`-schema table owned by this service) has somewhere to put it
without re-plumbing anything.
