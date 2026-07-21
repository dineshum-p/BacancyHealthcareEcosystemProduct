import type { Permission, UserRole } from "@hep/shared-types";

/**
 * Client-side mirror of `services/patient`'s `ROLE_PERMISSIONS` map (BAC-14 /
 * BAC-17, AC4; BAC-36/BAC-37) -- the permissions `apps/web` needs to gate UI
 * on: `'read_patient'` (searching/looking up patients), `'write_patient'`
 * (registering a patient), and `'review_patient_self_registration'`
 * (BAC-37: viewing/actioning the pending online self-registration queue --
 * deliberately a NARROWER, separate capability granted to `staff` as well as
 * `clinic_admin`/`super_admin`, unlike `write_patient` which `staff` does
 * NOT hold -- mirrors `services/patient`'s own `role-permissions.map.ts`
 * exactly, see that file's doc comment for the full rationale). Exactly like
 * `RequireRole`, this is a UX convenience only: the real enforcement is
 * `services/patient`'s own `PermissionsGuard`, which independently 403s.
 *
 * `'read_appointments'`/`'manage_appointments'` mirror `services/scheduling`'s
 * OWN `ROLE_PERMISSIONS` map (BAC-16/BAC-21) exactly the same way: every role
 * gets BOTH (the role-level split this map can express is "can this caller
 * use the schedule at all", not "whose calendar" -- that finer,
 * instance-level rule is a UI-only decision in `SchedulePage` based on
 * `user.role === 'provider'`, mirroring that service's
 * `provider-scope.util.ts`, and is independently re-enforced server-side
 * regardless of what this map says).
 */
const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  super_admin: [
    "read_patient",
    "write_patient",
    "review_patient_self_registration",
    "read_appointments",
    "manage_appointments",
  ],
  clinic_admin: [
    "read_patient",
    "write_patient",
    "review_patient_self_registration",
    "read_appointments",
    "manage_appointments",
  ],
  provider: [
    "read_patient",
    "write_patient",
    "read_appointments",
    "manage_appointments",
  ],
  staff: [
    "read_patient",
    "review_patient_self_registration",
    "read_appointments",
    "manage_appointments",
  ],
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
