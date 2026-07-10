/**
 * A single append-only audit-log row, mirroring `services/tenant`'s BAC-8
 * `AuditLogEntry` (and `services/emr`'s BAC-10 copy) exactly. `before`/
 * `after` are `unknown` because they hold whatever shape the audited
 * resource's response body has -- here always a `UsageEventResponse`, but
 * deliberately not typed as such, since the whole point of the
 * interceptor/decorator mechanism is to stay generic across resource types.
 */
export interface AuditLogEntry {
  id: string;
  /**
   * `null` when the mutation was performed by a caller with no verified
   * access-token identity. In practice every `/billing/*` mutation route in
   * this service is guarded by `AccessTokenGuard` (BAC-11), so this is
   * expected to always be a real user id here -- recorded as a nullable
   * field anyway for parity with the general-purpose mechanism this
   * duplicates.
   */
  actorUserId: string | null;
  /** Semantic action name derived from the HTTP method -- see `resolveAuditAction`. */
  action: string;
  /** The resource-type string passed to `@Audited(...)`, e.g. `'UsageEvent'`. */
  resourceType: string;
  /** `null` if the mutated resource's response body has no discoverable id. */
  resourceId: string | null;
  /**
   * Pre-mutation snapshot, or `null` for a creation (there is no "before" a
   * resource exists).
   */
  before: unknown;
  /** Post-mutation snapshot: the mutation's response body. */
  after: unknown;
  createdAt: Date;
}
