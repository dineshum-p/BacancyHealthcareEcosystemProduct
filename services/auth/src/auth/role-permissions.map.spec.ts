import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';
import {
  ALL_ROLES,
  getPermissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from './role-permissions.map';

describe('role-permissions.map', () => {
  it('AC1: seeds exactly the four RBAC roles', () => {
    expect(ALL_ROLES).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.CLINIC_ADMIN,
      UserRole.PROVIDER,
      UserRole.STAFF,
    ]);
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ALL_ROLES].sort());
  });

  it('grants MANAGE_USER_ROLES to super_admin and clinic_admin only', () => {
    expect(
      roleHasPermission(UserRole.SUPER_ADMIN, Permission.MANAGE_USER_ROLES),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.CLINIC_ADMIN, Permission.MANAGE_USER_ROLES),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.PROVIDER, Permission.MANAGE_USER_ROLES),
    ).toBe(false);
    expect(
      roleHasPermission(UserRole.STAFF, Permission.MANAGE_USER_ROLES),
    ).toBe(false);
  });

  it('grants VIEW_USERS to every role (illustrative broad permission)', () => {
    for (const role of ALL_ROLES) {
      expect(roleHasPermission(role, Permission.VIEW_USERS)).toBe(true);
    }
  });

  it('getPermissionsForRole returns the exact permission set for a role', () => {
    expect(getPermissionsForRole(UserRole.STAFF)).toEqual([
      Permission.VIEW_USERS,
    ]);
  });
});
