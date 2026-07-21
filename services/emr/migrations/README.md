# Migrations

This directory is intentionally empty, for the same reason `services/auth`'s
and `services/notification`'s are (see those services' `migrations/README.md`):

- `public.tenants` (the shared tenant registry) is owned and migrated by
  `services/tenant` (BAC-3/BAC-4). This service only ever reads it
  (`src/tenants/tenants.repository.ts`) -- it never provisions or mutates a
  tenant.
- This service's own domain tables -- `<tenant_schema>.patients` (BAC-10),
  `<tenant_schema>.audit_logs` (mirroring `services/tenant`'s BAC-8 mechanism),
  `<tenant_schema>.encounters` (BAC-15), and `<tenant_schema>.patient_profiles`
  (BAC-44, the patient's baseline clinical profile) -- live inside each
  tenant's dynamically provisioned Postgres schema, one per tenant, and can't
  be expressed as a single static migration. They are created lazily and
  idempotently by `EmrSchemaProvisioner` (`src/fhir/emr-schema.provisioner.ts`)
  the first time this process needs them for a given tenant -- the same
  pattern `NotificationsSchemaProvisioner` uses in `services/notification` and
  `AuthSchemaProvisioner` uses in `services/auth`. `EmrSchemaProvisioner` also
  installs the `pgcrypto` Postgres extension (`CREATE EXTENSION IF NOT EXISTS
  pgcrypto`, itself idempotent) the first time `patient_profiles` is
  provisioned for any tenant -- BAC-44's `allergies`/`chronic_conditions`
  columns are column-level encrypted via `pgp_sym_encrypt`/`pgp_sym_decrypt`
  (see `src/patient-profile/patient-profile.repository.ts`'s doc comment for
  the full pattern, intended to be replicated by BAC-45's own PHI fields).

The `migrate:up` / `migrate:down` npm scripts and `node-pg-migrate`
devDependency are kept for scaffold consistency with the other services, and
so a future ticket that needs a real static migration (e.g. a `public`-schema
table owned by this service) has somewhere to put it without re-plumbing
anything.
