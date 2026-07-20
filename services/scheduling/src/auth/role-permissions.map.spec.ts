import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';
import {
  getPermissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from './role-permissions.map';

describe('role-permissions.map', () => {
  it('grants MANAGE_APPOINTMENTS to every role', () => {
    for (const role of Object.values(UserRole)) {
      expect(roleHasPermission(role, Permission.MANAGE_APPOINTMENTS)).toBe(
        true,
      );
    }
  });

  it('grants READ_APPOINTMENTS to every role', () => {
    for (const role of Object.values(UserRole)) {
      expect(roleHasPermission(role, Permission.READ_APPOINTMENTS)).toBe(true);
    }
  });

  it('getPermissionsForRole returns the full permission set for a role', () => {
    expect(getPermissionsForRole(UserRole.STAFF)).toEqual([
      Permission.MANAGE_APPOINTMENTS,
      Permission.READ_APPOINTMENTS,
    ]);
  });

  it('ROLE_PERMISSIONS has an entry for every UserRole', () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
