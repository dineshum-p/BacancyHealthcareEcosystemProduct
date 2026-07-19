import type { Permission, UserRole } from "@hep/shared-types";

/**
 * Client-side mirror of `services/patient`'s `ROLE_PERMISSIONS` map (BAC-14 /
 * BAC-17, AC4) -- the only two permissions `apps/web` needs to gate UI on
 * today: `'read_patient'` (searching/looking up patients) and
 * `'write_patient'` (registering a patient). Exactly like `RequireRole`, this
 * is a UX convenience only: the real enforcement is `services/patient`'s own
 * `PermissionsGuard`, which independently 403s. See that service's
 * `role-permissions.map.ts` for the same "why" documented once, at the
 * source of truth.
 */
const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  super_admin: ["read_patient", "write_patient"],
  clinic_admin: ["read_patient", "write_patient"],
  provider: ["read_patient", "write_patient"],
  staff: ["read_patient"],
};

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return getPermissionsForRole(role).includes(permission);
}
