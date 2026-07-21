import { ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { UserRole } from '../auth/user-role.enum';
import { VisitIntakeRecord } from './visit-intake.entity';

/**
 * Roles that may read ANY visit intake tenant-wide (BAC-45, mirroring
 * BAC-36/37's staff-facing pending-review-queue pattern, `services/patient`'s
 * `PatientSelfRegistrationsController`). Deliberately does NOT include
 * `provider` -- unlike `provider-scope.util.ts`'s "any provider can act on
 * their own calendar broadly" rule, a `provider` here gets a NARROWER,
 * per-record instance check (see `assertVisitIntakeReadScope` below), not
 * blanket staff-side visibility.
 */
const STAFF_SIDE_ROLES: ReadonlySet<string> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.CLINIC_ADMIN,
  UserRole.STAFF,
]);

function canReadAnyIntake(role: string): boolean {
  return STAFF_SIDE_ROLES.has(role);
}

/**
 * `Set.has(role)` (rather than a direct `===` comparison against a
 * `UserRole` enum member) sidesteps comparing this service's own `UserRole`
 * TS enum against `AccessTokenPayload.role`'s plain string-literal-union
 * type -- same idiom `canReadAnyIntake`/every other scope-util in this repo
 * already uses for its role checks.
 */
const PATIENT_ROLE: ReadonlySet<string> = new Set([UserRole.PATIENT]);
const PROVIDER_ROLE: ReadonlySet<string> = new Set([UserRole.PROVIDER]);

/**
 * Enforces BAC-45's AC3 instance-level (resource-ownership) RBAC rule for
 * `GET /visit-intakes/:id`:
 *
 *   - `super_admin`/`clinic_admin`/`staff` may read ANY intake (triage-queue
 *     visibility, same as BAC-36/37's review queue).
 *   - The `patient` who submitted the intake may read their OWN (`userId`
 *     must equal `intake.patientId`).
 *   - A `provider` may read it ONLY if they are the SPECIFIC provider
 *     assigned to this intake (`userId` must equal
 *     `intake.assignedProviderId`) -- an unassigned intake
 *     (`assignedProviderId === null`) is not readable by ANY provider, and a
 *     provider who is not the assigned one is 403'd even if they are
 *     assigned to other intakes. This is deliberately NOT
 *     `provider-scope.util.ts`'s calendar-wide rule -- see this module's
 *     doc comment.
 *
 * Every other role (or an unrecognized one) is denied by default.
 */
export function assertVisitIntakeReadScope(
  user: AccessTokenPayload,
  intake: VisitIntakeRecord,
): void {
  if (canReadAnyIntake(user.role)) {
    return;
  }

  if (PATIENT_ROLE.has(user.role)) {
    if (user.userId === intake.patientId) {
      return;
    }
    throw new ForbiddenException(
      'Patients may only read their own visit intakes.',
    );
  }

  if (PROVIDER_ROLE.has(user.role)) {
    if (
      intake.assignedProviderId !== null &&
      user.userId === intake.assignedProviderId
    ) {
      return;
    }
    throw new ForbiddenException(
      'Only the provider assigned to this visit intake may read it.',
    );
  }

  throw new ForbiddenException(
    'You do not have permission to read this visit intake.',
  );
}
