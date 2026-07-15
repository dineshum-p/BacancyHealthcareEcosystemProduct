# Migrations

This directory is intentionally empty, for the same reason `services/auth`'s
and `services/notification`'s are (see those services' `migrations/README.md`):

- `public.tenants` (the shared tenant registry) is owned and migrated by
  `services/tenant` (BAC-3/BAC-4). This service only ever reads it
  (`src/tenants/tenants.repository.ts`) -- it never provisions or mutates a
  tenant.
- This service's own domain tables -- `<tenant_schema>.patients` (BAC-10),
  `<tenant_schema>.audit_logs` (mirroring `services/tenant`'s BAC-8 mechanism),
  and `<tenant_schema>.encounters` (BAC-15) -- live inside each tenant's
  dynamically provisioned Postgres schema, one per tenant, and can't be
  expressed as a single static migration. They are created lazily and
  idempotently by `EmrSchemaProvisioner` (`src/fhir/emr-schema.provisioner.ts`)
  the first time this process needs them for a given tenant -- the same
  pattern `NotificationsSchemaProvisioner` uses in `services/notification` and
  `AuthSchemaProvisioner` uses in `services/auth`.

The `migrate:up` / `migrate:down` npm scripts and `node-pg-migrate`
devDependency are kept for scaffold consistency with the other services, and
so a future ticket that needs a real static migration (e.g. a `public`-schema
table owned by this service) has somewhere to put it without re-plumbing
anything.
