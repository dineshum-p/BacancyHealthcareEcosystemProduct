/**
 * BAC-16's permission catalog, reusing the `@RequirePermissions`/
 * `PermissionsGuard` mechanism `services/auth` established for BAC-7 (and
 * `services/emr`/`services/billing`/`services/patient` reused) rather than
 * inventing a parallel authorization scheme for this service.
 *
 * `Permission` here is `services/scheduling`'s OWN enum (it cannot import
 * `services/auth`'s TypeScript -- independently deployable services, same
 * reason `UserRole` is duplicated too).
 *
 * Both permissions below are granted to every role (see
 * `role-permissions.map.ts`): the ROLE-level RBAC split this ticket requires
 * (`clinic_admin`/`staff` can act on ANY provider's calendar; `provider` can
 * only act on their OWN) is NOT expressible as a coarse role -> permission
 * grant -- it is an INSTANCE-level (resource-ownership) check, enforced
 * separately by `provider-scope.util.ts` inside `AppointmentsService`. This
 * guard only ever answers "is this role allowed to book/read appointments at
 * all", never "whose calendar".
 */
export enum Permission {
  /** Grants access to `POST /appointments` and `PATCH /appointments/:id` (BAC-16). */
  MANAGE_APPOINTMENTS = 'manage_appointments',
  /** Grants access to `GET /appointments` (BAC-16). */
  READ_APPOINTMENTS = 'read_appointments',
  /**
   * Grants access to `POST /visit-intakes` (BAC-45). Role-level only:
   * `patientId` is always the caller's own `userId` (self-scoped in
   * `VisitIntakesService.create`), so no separate instance-level check
   * applies to creation itself.
   */
  CREATE_VISIT_INTAKE = 'create_visit_intake',
  /**
   * Grants access to `GET /visit-intakes` (BAC-45, AC2): the staff-facing,
   * tenant-wide pending-review triage queue. Deliberately a SEPARATE
   * permission from `READ_VISIT_INTAKE` below -- granted only to staff-side
   * roles, never to `patient`/`provider` (who may each only ever read a
   * single, specific intake -- see `visit-intake-scope.util.ts`).
   */
  READ_VISIT_INTAKE_QUEUE = 'read_visit_intake_queue',
  /**
   * Grants access to `GET /visit-intakes/:id` (BAC-45, AC3) at the
   * ROLE level only -- WHICH specific intake a `patient`/`provider` caller
   * may actually read is an INSTANCE-level (resource-ownership) rule this
   * permission cannot express, enforced separately by
   * `assertVisitIntakeReadScope` (`visit-intake-scope.util.ts`) inside
   * `VisitIntakesService.findById`. Every staff-side role also holds this
   * (in addition to `READ_VISIT_INTAKE_QUEUE`) so `GET /visit-intakes/:id`
   * works for them too.
   */
  READ_VISIT_INTAKE = 'read_visit_intake',
  /** Grants access to `PATCH /visit-intakes/:id/link` (BAC-45, AC3): staff associate a specific provider + appointment with a pending intake. */
  LINK_VISIT_INTAKE = 'link_visit_intake',
}
