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
  ],
  [UserRole.CLINIC_ADMIN]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
  ],
  [UserRole.PROVIDER]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
  ],
  [UserRole.STAFF]: [
    Permission.MANAGE_APPOINTMENTS,
    Permission.READ_APPOINTMENTS,
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
