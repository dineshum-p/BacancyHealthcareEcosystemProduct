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
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.SUPER_ADMIN]: [Permission.READ_PATIENT, Permission.WRITE_PATIENT],
  [UserRole.CLINIC_ADMIN]: [Permission.READ_PATIENT, Permission.WRITE_PATIENT],
  [UserRole.PROVIDER]: [Permission.READ_PATIENT, Permission.WRITE_PATIENT],
  [UserRole.STAFF]: [Permission.READ_PATIENT],
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
