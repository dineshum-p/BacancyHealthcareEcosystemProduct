import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';
import {
  getPermissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from './role-permissions.map';

describe('role-permissions.map', () => {
  it('defines a permission set for every one of the four roles', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      [
        UserRole.SUPER_ADMIN,
        UserRole.CLINIC_ADMIN,
        UserRole.PROVIDER,
        UserRole.STAFF,
      ].sort(),
    );
  });

  it('grants RECORD_USAGE to every role (AC1)', () => {
    for (const role of Object.values(UserRole)) {
      expect(roleHasPermission(role, Permission.RECORD_USAGE)).toBe(true);
    }
  });

  it('grants READ_USAGE to super_admin and clinic_admin, but not provider/staff', () => {
    expect(roleHasPermission(UserRole.SUPER_ADMIN, Permission.READ_USAGE)).toBe(
      true,
    );
    expect(
      roleHasPermission(UserRole.CLINIC_ADMIN, Permission.READ_USAGE),
    ).toBe(true);
    expect(roleHasPermission(UserRole.PROVIDER, Permission.READ_USAGE)).toBe(
      false,
    );
    expect(roleHasPermission(UserRole.STAFF, Permission.READ_USAGE)).toBe(
      false,
    );
  });

  it('getPermissionsForRole returns the exact permission set for a role', () => {
    expect(getPermissionsForRole(UserRole.PROVIDER)).toEqual([
      Permission.RECORD_USAGE,
    ]);
  });
});
