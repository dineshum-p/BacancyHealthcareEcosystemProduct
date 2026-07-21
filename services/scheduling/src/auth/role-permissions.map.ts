import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';

/**
 * The role -> permission-set mapping for `services/scheduling` (BAC-16).
 *
 * Every role gets both permissions: role-level RBAC here only gates "can
 * this caller book/read appointments at all" -- the ticket's real
 * differentiator (`clinic_admin`/`staff` may act on ANY provider;
 * `provider` may only act on their OWN calendar) is an instance-level
 * (resource-ownership) rule that this map cannot express, so it is enforced
 * separately in `AppointmentsService` via `provider-scope.util.ts`. See
 * `permission.enum.ts`'s doc comment for the full rationale.
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
    Permission.READ_VISIT_INTAKE_QUEUE,
    Permission.READ_VISIT_INTAKE,
    Permission.LINK_VISIT_INTAKE,
  ],
  [UserRole.CLINIC_ADMIN]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
    Permission.READ_VISIT_INTAKE_QUEUE,
    Permission.READ_VISIT_INTAKE,
    Permission.LINK_VISIT_INTAKE,
  ],
  [UserRole.PROVIDER]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
    /**
     * BAC-45: a `provider` may read a SINGLE visit intake (the one they are
     * specifically assigned to -- see `visit-intake-scope.util.ts`), never
     * the tenant-wide triage queue (`READ_VISIT_INTAKE_QUEUE`, staff-side
     * only) and never the `link` mutation (`LINK_VISIT_INTAKE`,
     * staff-side only).
     */
    Permission.READ_VISIT_INTAKE,
  ],
  [UserRole.STAFF]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
    Permission.READ_VISIT_INTAKE_QUEUE,
    Permission.READ_VISIT_INTAKE,
    Permission.LINK_VISIT_INTAKE,
  ],
  /**
   * `PATIENT` (BAC-41) is granted NEITHER `MANAGE_APPOINTMENTS` nor
   * `READ_APPOINTMENTS` -- default-deny for this ticket's pre-existing
   * scope, unchanged by BAC-45. BAC-45 grants a NARROW, self-scoped pair:
   * `CREATE_VISIT_INTAKE` (submit their own intake) and `READ_VISIT_INTAKE`
   * (read only their OWN intake, never the tenant-wide queue or another
   * patient's -- enforced by `assertVisitIntakeReadScope`).
   */
  [UserRole.PATIENT]: [
    Permission.CREATE_VISIT_INTAKE,
    Permission.READ_VISIT_INTAKE,
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
