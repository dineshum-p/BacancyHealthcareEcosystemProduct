import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';

/**
 * The role -> permission-set mapping for `services/billing` (BAC-11, AC1/
 * AC4 access control).
 *
 * Documented choices:
 * - `RECORD_USAGE` is granted to every role: metering is a side-effect of an
 *   ordinary domain action (e.g. creating a patient or an encounter) any
 *   authenticated tenant user can already perform; the ingestion endpoint
 *   must not gate on a stricter privilege than the action it is metering.
 * - `READ_USAGE` (viewing aggregated usage/plan-limit status -- financial/
 *   operational data) is granted to `SUPER_ADMIN` and `CLINIC_ADMIN` only --
 *   deliberately NOT `PROVIDER`/`STAFF`, mirroring the least-privilege
 *   reasoning `services/auth`'s BAC-7 map applies to admin-only endpoints
 *   (e.g. `manage_user_roles`).
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.SUPER_ADMIN]: [Permission.RECORD_USAGE, Permission.READ_USAGE],
  [UserRole.CLINIC_ADMIN]: [Permission.RECORD_USAGE, Permission.READ_USAGE],
  [UserRole.PROVIDER]: [Permission.RECORD_USAGE],
  [UserRole.STAFF]: [Permission.RECORD_USAGE],
  /**
   * `PATIENT` (BAC-41) is deliberately granted NEITHER permission above --
   * default-deny, not silent inheritance of a staff-side permission set.
   * Unlike `services/scheduling`/`services/emr`/`services/patient`, this
   * service has no patient-owned resource a `patient` caller would ever
   * need to reach directly (usage metering is an internal, staff/admin-only
   * concern), so no `patient-scope.util.ts`-style utility is added here.
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
