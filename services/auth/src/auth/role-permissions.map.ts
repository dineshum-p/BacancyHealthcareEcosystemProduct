import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';

/**
 * The role -> permission-set mapping (BAC-7, AC1: "seeded and queryable" --
 * queryable over HTTP via `GET /auth/roles`, see `AuthService.listRoles`).
 *
 * Documented choices:
 * - `MANAGE_USER_ROLES` (role assignment) is granted to `SUPER_ADMIN` and
 *   `CLINIC_ADMIN`. A clinic admin plausibly needs to manage staff/provider
 *   roles within their own clinic (tenant); tenant isolation is enforced
 *   separately by `AuthService.updateUserRole` (the target user must resolve
 *   in the caller's own tenant schema), so granting this to `CLINIC_ADMIN`
 *   cannot cross tenant boundaries. Restricting WHICH roles a given role may
 *   grant (e.g. preventing a `CLINIC_ADMIN` from granting `SUPER_ADMIN`) is
 *   deliberately out of scope for this minimal implementation -- documented
 *   here, not silently omitted.
 * - `VIEW_USERS` is granted to every role. It has no endpoint of its own yet
 *   (see `permission.enum.ts`); it exists purely to prove the guard/decorator
 *   mechanism checks an arbitrary permission, not just `MANAGE_USER_ROLES`.
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.SUPER_ADMIN]: [Permission.MANAGE_USER_ROLES, Permission.VIEW_USERS],
  [UserRole.CLINIC_ADMIN]: [
    Permission.MANAGE_USER_ROLES,
    Permission.VIEW_USERS,
  ],
  [UserRole.PROVIDER]: [Permission.VIEW_USERS],
  [UserRole.STAFF]: [Permission.VIEW_USERS],
};

/** All four roles, in a stable order, for `GET /auth/roles` (AC1). */
export const ALL_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.PROVIDER,
  UserRole.STAFF,
];

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return getPermissionsForRole(role).includes(permission);
}
