/**
 * Mirrors `services/auth`'s `UserRole` enum (BAC-7) and the `UserRole` union
 * exported from `@hep/shared-types`. Duplicated here rather than imported:
 * `services/patient` is an independently deployable NestJS app with its own
 * `package.json`, so it cannot import TypeScript from `services/auth` -- it
 * only shares the same JWT `role` claim contract at the token level (same
 * approach `services/emr`/`services/billing` already established).
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  CLINIC_ADMIN = 'clinic_admin',
  PROVIDER = 'provider',
  STAFF = 'staff',
}
