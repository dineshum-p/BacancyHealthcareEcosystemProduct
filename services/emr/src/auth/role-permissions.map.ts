import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';

/**
 * The role -> permission-set mapping for the FHIR gateway (BAC-10, AC4).
 *
 * Documented choices:
 * - `READ_PATIENT` is granted to every role: any authenticated platform user
 *   (including front-desk `STAFF`) plausibly needs to look up a patient
 *   record they already know the id for (e.g. to check in a patient for a
 *   visit), and reading a resource is a much lower-risk operation than
 *   authoring one.
 * - `WRITE_PATIENT` (creating/amending the FHIR `Patient` resource that
 *   establishes a patient's core demographic identity) is granted to
 *   `SUPER_ADMIN`, `CLINIC_ADMIN`, and `PROVIDER` only -- deliberately NOT
 *   `STAFF`. This is a clinical-identity-integrity decision, not a
 *   least-privilege default copied mechanically from BAC-7: getting a
 *   patient's core demographics wrong (name/DOB/identifiers) has downstream
 *   clinical-safety consequences (e.g. mis-matched records), so this ticket
 *   restricts authoring that resource to clinical/administrative roles.
 *   Restricting this further (e.g. per-clinic scoping beyond tenant
 *   isolation) is out of scope here, same as BAC-7's own documented scope
 *   boundary.
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
