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
- `<tenant_schema>.visit_intakes` (BAC-45, a patient's per-visit intake
  submission -- distinct from BAC-44's one-time baseline profile) is
  similarly created lazily and idempotently, by
  `VisitIntakeSchemaProvisioner` (`src/visit-intakes/visit-intake-schema.provisioner.ts`).
  `reason_for_visit`/`symptoms`/`whats_new_since_last_visit` are column-level
  encrypted via the `pgcrypto` extension (`pgp_sym_encrypt`/
  `pgp_sym_decrypt`), replicating `services/emr`'s BAC-44
  `EmrSchemaProvisioner.ensurePatientProfilesTable`/`PatientProfileRepository`
  pattern exactly (see `src/visit-intakes/visit-intakes.repository.ts`'s doc
  comment) -- this service has its own `SCHEDULING_PGCRYPTO_COLUMN_KEY`-sourced
  `src/config/pgcrypto.config.ts`, independent of `services/emr`'s (a
  deliberately service-specific env var name -- see that config file's doc
  comment).

The `migrate:up` / `migrate:down` npm scripts and `node-pg-migrate`
devDependency are kept for scaffold consistency with the other services, and
so a future ticket that needs a real static migration (e.g. a `public`-schema
table owned by this service) has somewhere to put it without re-plumbing
anything.
