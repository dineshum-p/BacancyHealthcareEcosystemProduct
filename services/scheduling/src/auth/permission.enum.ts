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
}
