import type { Permission, UserRole } from "@hep/shared-types";

/**
 * Client-side mirror of the permissions `apps/web` needs to gate UI on.
 * `'read_patient'`/`'write_patient'` were added by BAC-14/BAC-17 and mirror
 * `services/patient`'s `ROLE_PERMISSIONS` exactly. Exactly like `RequireRole`,
 * this is a UX convenience only: the real enforcement is each backing
 * service's own `PermissionsGuard`, which independently 403s.
 *
 * `'read_encounter'`/`'write_encounter'` were added by BAC-20 for the SOAP
 * encounter-note editor and DELIBERATELY DIVERGE from `services/emr`'s own
 * `role-permissions.map.ts` (BAC-15), which grants `WRITE_ENCOUNTER` to
 * `super_admin`/`clinic_admin`/`provider` alike: BAC-20's acceptance criteria
 * are stricter than that ticket's server-side default and explicitly call
 * for a UI where ONLY `provider` (the treating clinician) can open/write/sign
 * a note, `clinic_admin` gets read-only oversight access, and `staff` has no
 * access to the note editor route at all -- including no read access, even
 * though `services/emr` itself also grants `READ_ENCOUNTER` to `staff` for
 * general chart lookups. Since this map is UI-gating only (the server remains
 * the actual authority), narrowing it here does not weaken real enforcement --
 * it only hides UI a caller isn't meant to be steered toward for this
 * feature. `super_admin` is treated like `clinic_admin` (read-only oversight,
 * no write) since the ticket doesn't call it out explicitly; this is a
 * judgment call, not dictated by an explicit acceptance criterion.
 */
const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  super_admin: ["read_patient", "write_patient", "read_encounter"],
  clinic_admin: ["read_patient", "write_patient", "read_encounter"],
  provider: [
    "read_patient",
    "write_patient",
    "read_encounter",
    "write_encounter",
  ],
  staff: ["read_patient"],
};

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return getPermissionsForRole(role).includes(permission);
}
