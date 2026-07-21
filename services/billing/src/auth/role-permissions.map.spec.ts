import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';
import {
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
  it('defines a permission set for every one of the five roles (BAC-41 adds patient)', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      [...STAFF_SIDE_ROLES, UserRole.PATIENT].sort(),
    );
  });

  it('grants RECORD_USAGE to every staff-side role (AC1)', () => {
    for (const role of STAFF_SIDE_ROLES) {
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

  describe('BAC-41: patient is default-deny', () => {
    it('grants patient NEITHER existing billing permission', () => {
      expect(roleHasPermission(UserRole.PATIENT, Permission.RECORD_USAGE)).toBe(
        false,
      );
      expect(roleHasPermission(UserRole.PATIENT, Permission.READ_USAGE)).toBe(
        false,
      );
    });

    it('getPermissionsForRole returns an empty set for patient', () => {
      expect(getPermissionsForRole(UserRole.PATIENT)).toEqual([]);
    });
  });
});
