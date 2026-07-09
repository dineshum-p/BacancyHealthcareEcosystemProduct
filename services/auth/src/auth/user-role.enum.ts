/**
 * The four roles a user can hold within a tenant (BAC-7). Replaces BAC-5's
 * single-value `MEMBER` placeholder now that role-based access control is
 * implemented.
 *
 * Registration default (`POST /auth/register`, see `AuthService.register`):
 * `STAFF` -- the least-privileged role -- for every registration EXCEPT one
 * whose (case-insensitively normalized) email exactly matches the tenant's
 * `ownerEmail` (set once, at tenant-creation time in `services/tenant`),
 * which is automatically assigned `SUPER_ADMIN` (see the bootstrap-admin
 * doc comment on `AuthService.register`). There is deliberately no separate
 * seeding/admin-invite flow; this is the one, minimal way a tenant ever
 * gets its first administrator through the public API.
 *
 * Mirrors the `UserRole` union exported from `@hep/shared-types`.
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  CLINIC_ADMIN = 'clinic_admin',
  PROVIDER = 'provider',
  STAFF = 'staff',
}

/** Registration default for every user after a tenant's first (see `UserRole` doc comment). */
export const DEFAULT_REGISTRATION_ROLE = UserRole.STAFF;
