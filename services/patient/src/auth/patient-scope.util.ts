import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { UserRole } from './user-role.enum';

/**
 * BAC-41's instance-level (resource-ownership) RBAC rule for a `patient`
 * caller, mirroring `services/scheduling`'s `provider-scope.util.ts`
 * (`assertProviderScope`/`resolveScopedProviderId`) shape exactly: every
 * clinic-staff-side role (`super_admin`/`clinic_admin`/`provider`/`staff`)
 * may act on ANY patient's record; a `patient` may only ever act on their
 * OWN (`targetPatientId` must equal their own `userId`).
 *
 * Deliberately generic/reusable rather than hardcoded to one entity type:
 * the caller supplies whichever id the resource in question uses as its
 * owning-patient field (this service's own `patients` record id, a
 * self-registration's resulting patient id, etc.), and this utility only
 * ever compares it against the caller's `userId`. This ticket (BAC-41) only
 * adds this utility as a foundation; no controller/service wires it in yet
 * -- a follow-on ticket (e.g. BAC-42/BAC-43) is expected to be the first
 * real caller, once `role-permissions.map.ts` grants `patient` a narrow,
 * self-scoped permission to reach the code path that would call these.
 */
const STAFF_SIDE_ROLES: ReadonlySet<string> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.PROVIDER,
  UserRole.STAFF,
]);

function canActOnAnyPatient(role: string): boolean {
  return STAFF_SIDE_ROLES.has(role);
}

/**
 * Enforces the self-scoping rule for a mutation/read on a specific,
 * already-identified patient-owned resource: throws `ForbiddenException`
 * unless the caller is a staff-side role OR the resource's owning-patient
 * id equals the caller's own `userId`.
 */
export function assertPatientScope(
  user: AccessTokenPayload,
  targetPatientId: string,
): void {
  if (canActOnAnyPatient(user.role)) {
    return;
  }
  if (user.userId !== targetPatientId) {
    throw new ForbiddenException('Patients may only access their own records.');
  }
}

/**
 * Resolves WHICH patient a query should be scoped to, mirroring
 * `resolveScopedProviderId`'s exact shape: a staff-side caller MUST supply
 * `requestedPatientId` (400 otherwise, since "any patient" is not itself a
 * valid query); a `patient` caller's own id is used by default (and, if
 * they supply one anyway, it must match their own -- 403 otherwise).
 */
export function resolveScopedPatientId(
  user: AccessTokenPayload,
  requestedPatientId: string | undefined,
): string {
  if (canActOnAnyPatient(user.role)) {
    if (!requestedPatientId) {
      throw new BadRequestException(
        'patientId query parameter is required for this role.',
      );
    }
    return requestedPatientId;
  }

  if (requestedPatientId && requestedPatientId !== user.userId) {
    throw new ForbiddenException('Patients may only access their own records.');
  }
  return user.userId;
}
