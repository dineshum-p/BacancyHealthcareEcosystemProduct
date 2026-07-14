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

  it('grants READ_PATIENT to every role (AC4)', () => {
    for (const role of Object.values(UserRole)) {
      expect(roleHasPermission(role, Permission.READ_PATIENT)).toBe(true);
    }
  });

  it('grants WRITE_PATIENT to super_admin, clinic_admin, and provider, but not staff', () => {
    expect(
      roleHasPermission(UserRole.SUPER_ADMIN, Permission.WRITE_PATIENT),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.CLINIC_ADMIN, Permission.WRITE_PATIENT),
    ).toBe(true);
    expect(roleHasPermission(UserRole.PROVIDER, Permission.WRITE_PATIENT)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.STAFF, Permission.WRITE_PATIENT)).toBe(
      false,
    );
  });

  it('getPermissionsForRole returns the exact permission set for a role', () => {
    expect(getPermissionsForRole(UserRole.STAFF)).toEqual([
      Permission.READ_PATIENT,
      Permission.READ_ENCOUNTER,
    ]);
  });

  it('grants READ_ENCOUNTER to every role (BAC-15, AC2)', () => {
    for (const role of Object.values(UserRole)) {
      expect(roleHasPermission(role, Permission.READ_ENCOUNTER)).toBe(true);
    }
  });

  it('grants WRITE_ENCOUNTER to super_admin, clinic_admin, and provider, but not staff (BAC-15, AC1)', () => {
    expect(
      roleHasPermission(UserRole.SUPER_ADMIN, Permission.WRITE_ENCOUNTER),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.CLINIC_ADMIN, Permission.WRITE_ENCOUNTER),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.PROVIDER, Permission.WRITE_ENCOUNTER),
    ).toBe(true);
    expect(roleHasPermission(UserRole.STAFF, Permission.WRITE_ENCOUNTER)).toBe(
      false,
    );
  });
});
