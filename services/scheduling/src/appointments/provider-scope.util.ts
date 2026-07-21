import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { UserRole } from '../auth/user-role.enum';

/**
 * Roles allowed to book/reschedule/cancel a slot on ANY provider's calendar
 * (BAC-16's RBAC, "cross-provider, front-desk booking"). `super_admin` is
 * included for the same least-privilege-superset reasoning every other
 * service's role-permission map already applies (e.g.
 * `services/billing`'s `ROLE_PERMISSIONS`): a role with strictly MORE
 * administrative reach than `clinic_admin` must not be MORE restricted than
 * it.
 */
const CROSS_PROVIDER_ROLES: ReadonlySet<string> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.STAFF,
]);

function canActOnAnyProvider(role: string): boolean {
  return CROSS_PROVIDER_ROLES.has(role);
}

/**
 * Enforces BAC-16's instance-level (resource-ownership) RBAC rule for a
 * mutation (`POST /appointments`, `PATCH /appointments/:id`):
 * `clinic_admin`/`staff`/`super_admin` may act on any provider's calendar;
 * a `provider` may only act on their OWN (`targetProviderId` must equal
 * their own `userId`). This is deliberately NOT expressible via
 * `PermissionsGuard`/`ROLE_PERMISSIONS` (a coarse, role-level mechanism) --
 * see `permission.enum.ts`'s doc comment -- so it is checked here, in the
 * service layer, against the specific appointment/booking request in
 * question.
 */
export function assertProviderScope(
  user: AccessTokenPayload,
  targetProviderId: string,
): void {
  if (canActOnAnyProvider(user.role)) {
    return;
  }
  if (user.userId !== targetProviderId) {
    throw new ForbiddenException(
      'Providers may only manage appointments on their own calendar.',
    );
  }
}

/**
 * Resolves WHICH provider's calendar `GET /appointments?date=` should query
 * (BAC-16, AC2's RBAC): `clinic_admin`/`staff`/`super_admin` may query any
 * provider's day, so they MUST supply `providerId`; a `provider` may only
 * ever see their own day, so `providerId` is optional for them (defaults to
 * their own `userId`) and, if supplied anyway, must match their own id.
 */
export function resolveScopedProviderId(
  user: AccessTokenPayload,
  requestedProviderId: string | undefined,
): string {
  if (canActOnAnyProvider(user.role)) {
    if (!requestedProviderId) {
      throw new BadRequestException(
        'providerId query parameter is required for this role.',
      );
    }
    return requestedProviderId;
  }

  if (requestedProviderId && requestedProviderId !== user.userId) {
    throw new ForbiddenException(
      'Providers may only view appointments on their own calendar.',
    );
  }
  return user.userId;
}
