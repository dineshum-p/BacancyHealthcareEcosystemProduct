/**
 * BAC-10's permission catalog, reusing the `@RequirePermissions`/
 * `PermissionsGuard` mechanism `services/auth` established for BAC-7 rather
 * than inventing a parallel authorization scheme for this service.
 *
 * `Permission` here is `services/emr`'s OWN enum (it cannot import
 * `services/auth`'s TypeScript -- independently deployable services, same
 * reason `UserRole` is duplicated too), but its string values are drawn from
 * the union extended onto `@hep/shared-types`' shared `Permission` type, so
 * a JWT's `role` claim (verified by `AccessTokenGuard`, itself unrelated to
 * this enum) maps onto the SAME permission vocabulary everywhere it's
 * checked.
 */
export enum Permission {
  /** Grants access to `GET /fhir/Patient/:id` (BAC-10, AC1). */
  READ_PATIENT = 'read_patient',
  /** Grants access to `POST /fhir/Patient` (BAC-10, AC2). */
  WRITE_PATIENT = 'write_patient',
}
