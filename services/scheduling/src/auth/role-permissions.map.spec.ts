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
      Permission.READ_VISIT_INTAKE_QUEUE,
      Permission.READ_VISIT_INTAKE,
      Permission.LINK_VISIT_INTAKE,
    ]);
  });

  it('ROLE_PERMISSIONS has an entry for every UserRole', () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  describe('BAC-41: patient is default-deny for pre-existing appointment permissions', () => {
    it('grants patient NEITHER existing appointment permission', () => {
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.MANAGE_APPOINTMENTS),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.READ_APPOINTMENTS),
      ).toBe(false);
    });
  });

  describe('BAC-45: visit-intake permissions', () => {
    const STAFF_TRIAGE_ROLES = [
      UserRole.SUPER_ADMIN,
      UserRole.CLINIC_ADMIN,
      UserRole.STAFF,
    ] as const;

    it('grants READ_VISIT_INTAKE_QUEUE and LINK_VISIT_INTAKE only to staff-side triage roles', () => {
      for (const role of STAFF_TRIAGE_ROLES) {
        expect(
          roleHasPermission(role, Permission.READ_VISIT_INTAKE_QUEUE),
        ).toBe(true);
        expect(roleHasPermission(role, Permission.LINK_VISIT_INTAKE)).toBe(
          true,
        );
      }
      expect(
        roleHasPermission(
          UserRole.PROVIDER,
          Permission.READ_VISIT_INTAKE_QUEUE,
        ),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PROVIDER, Permission.LINK_VISIT_INTAKE),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.READ_VISIT_INTAKE_QUEUE),
      ).toBe(false);
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.LINK_VISIT_INTAKE),
      ).toBe(false);
    });

    it('grants READ_VISIT_INTAKE to every role except (unauthenticated/default)', () => {
      for (const role of [
        ...STAFF_TRIAGE_ROLES,
        UserRole.PROVIDER,
        UserRole.PATIENT,
      ]) {
        expect(roleHasPermission(role, Permission.READ_VISIT_INTAKE)).toBe(
          true,
        );
      }
    });

    it('grants CREATE_VISIT_INTAKE only to patient', () => {
      expect(
        roleHasPermission(UserRole.PATIENT, Permission.CREATE_VISIT_INTAKE),
      ).toBe(true);
      for (const role of [...STAFF_TRIAGE_ROLES, UserRole.PROVIDER]) {
        expect(roleHasPermission(role, Permission.CREATE_VISIT_INTAKE)).toBe(
          false,
        );
      }
    });
  });
});
