/**
 * Delivery lifecycle for a notification (AC2/AC3): `QUEUED` on creation,
 * before the async send is attempted; `SENT` once the provider adapter
 * confirms delivery; `FAILED` only once every retry attempt (with backoff)
 * has been exhausted. Mirrors `@hep/shared-types`'s `NotificationStatus`
 * string-literal union -- this enum is this service's internal/DB
 * representation of the same values.
 */
export enum NotificationStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}
