import type { AccessTokenPayload, UserRole } from "@hep/shared-types";

/**
 * Frontend mirror of `services/scheduling`'s `provider-scope.util.ts`
 * (`CROSS_PROVIDER_ROLES`/`canActOnAnyProvider`) (BAC-16/BAC-21 RBAC):
 * `clinic_admin`/`staff`/`super_admin` may book/view/manage ANY provider's
 * calendar (and so see a provider picker in `SchedulePage`); a `provider`
 * may only ever act on their OWN. This is a UX convenience only -- the real
 * enforcement is that service's own `assertProviderScope`/
 * `resolveScopedProviderId`, which independently 403s/400s.
 */
const CROSS_PROVIDER_ROLES: ReadonlySet<UserRole> = new Set([
  "super_admin",
  "clinic_admin",
  "staff",
]);

export function canManageAnyProvidersSchedule(role: UserRole): boolean {
  return CROSS_PROVIDER_ROLES.has(role);
}

/**
 * A `provider` caller's own calendar is always their own `userId` -- no
 * picker is ever shown for this role (see `SchedulePage`), mirroring
 * `resolveScopedProviderId`'s default for a non-cross-provider role.
 */
export function resolveOwnProviderId(user: AccessTokenPayload): string {
  return user.userId;
}
