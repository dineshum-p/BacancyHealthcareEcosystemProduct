/**
 * The permission catalog for BAC-7. Deliberately minimal: this repo has no
 * patient/clinic/EMR endpoints yet (those are later phases per
 * `docs/HEP_ARCHITECTURE.md`), so this does NOT attempt to imagine a full
 * permission catalog for resources that don't exist. It defines just enough
 * to (a) protect the one real capability this ticket adds -- role
 * assignment itself -- and (b) prove the `@RequirePermissions`/
 * `PermissionsGuard` mechanism generalizes beyond a single hardcoded check.
 *
 * Mirrors the `Permission` union exported from `@hep/shared-types`.
 */
export enum Permission {
  /** Grants access to `PATCH /auth/users/:id/role`. */
  MANAGE_USER_ROLES = 'manage_user_roles',
  /**
   * Illustrative read permission with no corresponding endpoint of its own
   * yet -- included only to prove the guard/decorator checks an arbitrary
   * permission, not just `MANAGE_USER_ROLES`. Mapped broadly (every role) in
   * `role-permissions.map.ts`.
   */
  VIEW_USERS = 'view_users',
}
