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
 * `RequireRole`, this is a UX convenience only: the real enforcement is each
 * backing service's own `PermissionsGuard`, which independently 403s.
 *
 * `'read_appointments'`/`'manage_appointments'` mirror `services/scheduling`'s
 * OWN `ROLE_PERMISSIONS` map (BAC-16/BAC-21) exactly the same way: every role
 * gets BOTH (the role-level split this map can express is "can this caller
 * use the schedule at all", not "whose calendar" -- that finer,
 * instance-level rule is a UI-only decision in `SchedulePage` based on
 * `user.role === 'provider'`, mirroring that service's
 * `provider-scope.util.ts`, and is independently re-enforced server-side
 * regardless of what this map says).
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
 *
 * `patient` (BAC-41) was a type-completeness addition only through BAC-44: no
 * backend service granted `patient` any of these permissions (default-deny),
 * so there was no real UI gating decision to make. BAC-46 is that
 * later, patient-portal-facing ticket: `services/emr`'s
 * `role-permissions.map.ts` grants `patient` BOTH `READ_PATIENT_PROFILE` and
 * `WRITE_PATIENT_PROFILE` (self-scoped, enforced server-side via
 * `assertPatientScope`), so `'read_patient_profile'` gates `/profile`
 * (`PatientProfilePage`) here the same way. Deliberately NOT added to any
 * staff-side role's list here: this page is scoped to "MY profile" for the
 * logged-in patient only (BAC-46) -- a staff-facing per-patient profile view
 * is out of scope and would be a separate, later UI gating decision even
 * though the backend already grants staff roles the same server-side
 * permission for a future such page.
 */
const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  super_admin: [
    "read_patient",
    "write_patient",
    "review_patient_self_registration",
    "read_appointments",
    "manage_appointments",
    "read_encounter",
  ],
  clinic_admin: [
    "read_patient",
    "write_patient",
    "review_patient_self_registration",
    "read_appointments",
    "manage_appointments",
    "read_encounter",
  ],
  provider: [
    "read_patient",
    "write_patient",
    "read_appointments",
    "manage_appointments",
    "read_encounter",
    "write_encounter",
  ],
  staff: [
    "read_patient",
    "review_patient_self_registration",
    "read_appointments",
    "manage_appointments",
  ],
  patient: ["read_patient_profile", "write_patient_profile"],
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
