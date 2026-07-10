/**
 * BAC-11's permission catalog, reusing the `@RequirePermissions`/
 * `PermissionsGuard` mechanism `services/auth` established for BAC-7 (and
 * `services/emr` reused for BAC-10) rather than inventing a parallel
 * authorization scheme for this service.
 *
 * `Permission` here is `services/billing`'s OWN enum (it cannot import
 * `services/auth`'s TypeScript -- independently deployable services, same
 * reason `UserRole` is duplicated too).
 */
export enum Permission {
  /**
   * Grants access to `POST /billing/usage/events` (BAC-11, AC1): recording a
   * metered usage event. Granted broadly (every role) because a usage event
   * corresponds to an ordinary domain action a user of any role can already
   * legitimately trigger elsewhere in the platform (e.g. a `STAFF` user
   * creating a patient) -- metering that action must not require a
   * privilege the underlying action itself doesn't require.
   */
  RECORD_USAGE = 'record_usage',
  /**
   * Grants access to `GET /billing/usage` (BAC-11, AC2/AC4): reading
   * aggregated usage totals and plan-limit status. Restricted to
   * administrative roles -- usage/billing data is operational/financial
   * information, not something every day-to-day clinical user needs to see.
   */
  READ_USAGE = 'read_usage',
}
