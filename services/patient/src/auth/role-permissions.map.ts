import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';

/**
 * The role -> permission-set mapping for `services/patient` (BAC-14).
 * Mirrors `services/emr`'s BAC-10 map for the SAME two permissions exactly
 * (this service is the registration/search counterpart to that FHIR
 * gateway):
 * - `READ_PATIENT` (searching/looking up patients, AC3) is granted to every
 *   role: any authenticated platform user (including front-desk `STAFF`)
 *   plausibly needs to look up/search for a patient (e.g. to check one in
 *   for a visit), and reading is a much lower-risk operation than authoring.
 * - `WRITE_PATIENT` (registering a new patient and assigning their MRN, AC1)
 *   is granted to `SUPER_ADMIN`, `CLINIC_ADMIN`, and `PROVIDER` only --
 *   deliberately NOT `STAFF`. This is a clinical-identity-integrity
 *   decision: getting a patient's core demographics or MRN assignment wrong
 *   has downstream clinical-safety consequences (e.g. mis-matched records),
 *   so this ticket restricts authoring that resource to clinical/
 *   administrative roles, exactly as `services/emr`'s BAC-10 map does.
 * - `REVIEW_SELF_REGISTRATION` (BAC-36: viewing the pending online
 *   self-registration queue and approving/rejecting/merging an entry) is
 *   granted to `SUPER_ADMIN`, `CLINIC_ADMIN`, AND `STAFF` -- deliberately a
 *   NARROWER, separate capability from `WRITE_PATIENT`, not folded into it:
 *   confirming that a self-registration is who they claim to be (against
 *   duplicate-detection evidence) is front-desk triage work `STAFF`
 *   plausibly does today, unlike authoring a brand-new patient's core
 *   demographics/MRN from scratch, which stays clinical/administrative-only.
 *   `PROVIDER` deliberately does NOT get this permission (per BAC-36's AC:
 *   "provider has no special access to this queue beyond normal
 *   read_patient once a registration is confirmed").
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.READ_PATIENT,
    Permission.WRITE_PATIENT,
    Permission.REVIEW_SELF_REGISTRATION,
  ],
  [UserRole.CLINIC_ADMIN]: [
    Permission.READ_PATIENT,
    Permission.WRITE_PATIENT,
    Permission.REVIEW_SELF_REGISTRATION,
  ],
  [UserRole.PROVIDER]: [Permission.READ_PATIENT, Permission.WRITE_PATIENT],
  [UserRole.STAFF]: [
    Permission.READ_PATIENT,
    Permission.REVIEW_SELF_REGISTRATION,
  ],
  /**
   * `PATIENT` (BAC-41) is deliberately granted NONE of the permissions
   * above -- default-deny, not silent inheritance of a staff-side
   * permission set. A later ticket (e.g. BAC-44) that wants a patient to
   * read their OWN record would need to grant a narrow permission here AND
   * enforce ownership via a `patient-scope.util.ts`-style utility (see that
   * file, added by this ticket) -- neither exists yet.
   */
  [UserRole.PATIENT]: [],
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
