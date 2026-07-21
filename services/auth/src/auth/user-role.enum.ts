/**
 * The five roles a user can hold within a tenant (BAC-7; `PATIENT` added by
 * BAC-41). Replaces BAC-5's single-value `MEMBER` placeholder now that
 * role-based access control is implemented.
 *
 * Registration default (`POST /auth/register`, see `AuthService.register`):
 * `STAFF` -- the least-privileged role -- for every registration EXCEPT one
 * whose (case-insensitively normalized) email exactly matches the tenant's
 * `ownerEmail` (set once, at tenant-creation time in `services/tenant`),
 * which is automatically assigned `SUPER_ADMIN` (see the bootstrap-admin
 * doc comment on `AuthService.register`). There is deliberately no separate
 * seeding/admin-invite flow; this is the one, minimal way a tenant ever
 * gets its first administrator through the public API. `PATIENT` is not
 * (yet) reachable through this registration flow either -- see BAC-41's
 * report for why that is explicitly out of this ticket's scope.
 *
 * `PATIENT` (BAC-41) is the one non-clinic-staff role: every other role is
 * clinic-staff-side (can, at minimum, act within its own tenant broadly); a
 * `PATIENT` caller is instance-scoped to resources where they themselves are
 * the subject. `ROLE_PERMISSIONS` grants `PATIENT` none of this service's
 * existing (staff-only) permissions -- default-deny, not silent inheritance.
 *
 * Mirrors the `UserRole` union exported from `@hep/shared-types`.
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  CLINIC_ADMIN = 'clinic_admin',
  PROVIDER = 'provider',
  STAFF = 'staff',
  PATIENT = 'patient',
}

/** Registration default for every user after a tenant's first (see `UserRole` doc comment). */
export const DEFAULT_REGISTRATION_ROLE = UserRole.STAFF;
