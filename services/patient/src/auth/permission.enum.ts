/**
 * BAC-14's permission catalog, reusing the `@RequirePermissions`/
 * `PermissionsGuard` mechanism `services/auth` established for BAC-7 (and
 * `services/emr`/`services/billing` reused for BAC-10/BAC-11) rather than
 * inventing a parallel authorization scheme for this service.
 *
 * `Permission` here is `services/patient`'s OWN enum (it cannot import
 * `services/auth`'s TypeScript -- independently deployable services, same
 * reason `UserRole` is duplicated too), but its string values are drawn from
 * the union extended onto `@hep/shared-types`' shared `Permission` type
 * (`'read_patient'`/`'write_patient'`, added by BAC-10), so a JWT's `role`
 * claim maps onto the SAME permission vocabulary everywhere it's checked.
 */
export enum Permission {
  /** Grants access to `GET /patients` (BAC-14, AC3). */
  READ_PATIENT = 'read_patient',
  /** Grants access to `POST /patients` (BAC-14, AC1). */
  WRITE_PATIENT = 'write_patient',
  /**
   * Grants access to the pending-self-registration queue and the
   * approve/reject/merge actions on it (BAC-36): `GET
   * /patients/self-registrations`, `POST
   * /patients/self-registrations/:id/approve`, `.../reject`, `.../merge`.
   * Deliberately narrower than `WRITE_PATIENT` -- see
   * `role-permissions.map.ts`'s doc comment for why `staff` is granted THIS
   * permission but not `WRITE_PATIENT`.
   */
  REVIEW_SELF_REGISTRATION = 'review_patient_self_registration',
}
