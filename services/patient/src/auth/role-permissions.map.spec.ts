import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';
import {
  getPermissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from './role-permissions.map';

describe('role-permissions.map', () => {
  it('grants READ_PATIENT to every role', () => {
    for (const role of Object.values(UserRole)) {
      expect(roleHasPermission(role, Permission.READ_PATIENT)).toBe(true);
    }
  });

  it('grants WRITE_PATIENT to super_admin, clinic_admin, and provider', () => {
    expect(
      roleHasPermission(UserRole.SUPER_ADMIN, Permission.WRITE_PATIENT),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.CLINIC_ADMIN, Permission.WRITE_PATIENT),
    ).toBe(true);
    expect(roleHasPermission(UserRole.PROVIDER, Permission.WRITE_PATIENT)).toBe(
      true,
    );
  });

  it('does NOT grant WRITE_PATIENT to staff', () => {
    expect(roleHasPermission(UserRole.STAFF, Permission.WRITE_PATIENT)).toBe(
      false,
    );
  });

  it('getPermissionsForRole returns the full permission set for a role', () => {
    expect(getPermissionsForRole(UserRole.STAFF)).toEqual([
      Permission.READ_PATIENT,
    ]);
  });

  it('ROLE_PERMISSIONS has an entry for every UserRole', () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
