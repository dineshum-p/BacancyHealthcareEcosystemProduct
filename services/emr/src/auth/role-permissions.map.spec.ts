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

  it('grants READ_PATIENT to every staff-side role (AC4)', () => {
    for (const role of STAFF_SIDE_ROLES) {
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
      Permission.READ_PATIENT_PROFILE,
      Permission.WRITE_PATIENT_PROFILE,
    ]);
  });

  it('grants READ_ENCOUNTER to every staff-side role (BAC-15, AC2)', () => {
    for (const role of STAFF_SIDE_ROLES) {
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

  describe('BAC-41: patient is default-deny (except BAC-44 profile self-service)', () => {
    it('grants patient NONE of the pre-existing staff-only permissions', () => {
      expect(roleHasPermission(UserRole.PATIENT, Permission.READ_PATIENT)).toBe(
        false,
      );
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.WRITE_PATIENT),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.READ_ENCOUNTER),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.WRITE_ENCOUNTER),
      ).toBe(false);
    });

    it('getPermissionsForRole returns only the BAC-44 profile permissions for patient', () => {
      expect(getPermissionsForRole(UserRole.PATIENT)).toEqual([
        Permission.READ_PATIENT_PROFILE,
        Permission.WRITE_PATIENT_PROFILE,
      ]);
    });
  });

  describe('BAC-44: patient baseline profile permissions', () => {
    it('grants READ_PATIENT_PROFILE and WRITE_PATIENT_PROFILE to every staff-side role, INCLUDING staff', () => {
      for (const role of STAFF_SIDE_ROLES) {
        expect(roleHasPermission(role, Permission.READ_PATIENT_PROFILE)).toBe(
          true,
        );
        expect(roleHasPermission(role, Permission.WRITE_PATIENT_PROFILE)).toBe(
          true,
        );
      }
    });

    it('grants READ_PATIENT_PROFILE and WRITE_PATIENT_PROFILE to patient (self-scoping enforced elsewhere)', () => {
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.READ_PATIENT_PROFILE),
      ).toBe(true);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.WRITE_PATIENT_PROFILE),
      ).toBe(true);
    });
  });
});
