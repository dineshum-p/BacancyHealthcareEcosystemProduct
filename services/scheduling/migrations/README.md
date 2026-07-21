# Migrations

This directory is intentionally empty, for the same reason `services/auth`'s,
`services/notification`'s, `services/emr`'s, `services/billing`'s, and
`services/patient`'s are (see those services' `migrations/README.md`):

- `public.tenants` (the shared tenant registry) is owned and migrated by
  `services/tenant` (BAC-3/BAC-4). This service only ever reads it
  (`src/tenants/tenants.repository.ts`) -- it never provisions or mutates a
  tenant.
- This service's own domain tables -- `<tenant_schema>.appointments` (BAC-16)
  and `<tenant_schema>.audit_logs` (mirroring `services/tenant`'s BAC-8
  mechanism) -- live inside each tenant's dynamically provisioned Postgres
  schema, one per tenant, and can't be expressed as a single static migration.
  They are created lazily and idempotently by `AppointmentSchemaProvisioner`
  (`src/appointments/appointment-schema.provisioner.ts`) the first time this
  process needs them for a given tenant -- the same pattern
  `PatientSchemaProvisioner`/`EmrSchemaProvisioner`/`BillingSchemaProvisioner`/
  `NotificationsSchemaProvisioner`/`AuthSchemaProvisioner` use in their own
  services.

The `migrate:up` / `migrate:down` npm scripts and `node-pg-migrate`
devDependency are kept for scaffold consistency with the other services, and
so a future ticket that needs a real static migration (e.g. a `public`-schema
table owned by this service) has somewhere to put it without re-plumbing
anything.
