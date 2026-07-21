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
  it('grants MANAGE_APPOINTMENTS to every staff-side role', () => {
    for (const role of STAFF_SIDE_ROLES) {
      expect(roleHasPermission(role, Permission.MANAGE_APPOINTMENTS)).toBe(
        true,
      );
    }
  });

  it('grants READ_APPOINTMENTS to every staff-side role', () => {
    for (const role of STAFF_SIDE_ROLES) {
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

  describe('BAC-41: patient is default-deny', () => {
    it('grants patient NEITHER existing appointment permission', () => {
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.MANAGE_APPOINTMENTS),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.READ_APPOINTMENTS),
      ).toBe(false);
    });

    it('getPermissionsForRole returns an empty set for patient', () => {
      expect(getPermissionsForRole(UserRole.PATIENT)).toEqual([]);
    });
  });
});
