import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';
import {
  ALL_ROLES,
  getPermissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from './role-permissions.map';

/** The four pre-BAC-41 clinic-staff-side roles, i.e. everyone except `patient`. */
const STAFF_SIDE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.PROVIDER,
  UserRole.STAFF,
] as const;

describe('role-permissions.map', () => {
  it('AC1: seeds exactly the five RBAC roles (BAC-41 adds patient)', () => {
    expect(ALL_ROLES).toEqual([...STAFF_SIDE_ROLES, UserRole.PATIENT]);
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

  it('grants VIEW_USERS to every staff-side role (illustrative broad permission)', () => {
    for (const role of STAFF_SIDE_ROLES) {
      expect(roleHasPermission(role, Permission.VIEW_USERS)).toBe(true);
    }
  });

  it('getPermissionsForRole returns the exact permission set for a role', () => {
    expect(getPermissionsForRole(UserRole.STAFF)).toEqual([
      Permission.VIEW_USERS,
    ]);
  });

  describe('BAC-41: patient is default-deny', () => {
    it('grants patient NEITHER existing staff-only permission', () => {
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.MANAGE_USER_ROLES),
      ).toBe(false);
      expect(roleHasPermission(UserRole.PATIENT, Permission.VIEW_USERS)).toBe(
        false,
      );
    });

    it('getPermissionsForRole returns an empty set for patient', () => {
      expect(getPermissionsForRole(UserRole.PATIENT)).toEqual([]);
    });
  });
});
