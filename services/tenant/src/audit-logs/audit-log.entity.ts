/**
 * A single append-only audit-log row (BAC-8, AC1). `before`/`after` are
 * `unknown` (not `unknown | null` narrowed further) because they hold
 * whatever shape the audited resource's response body has -- `Tenant`,
 * `Item`, or any future resource type -- deliberately not typed per-resource
 * here, since the whole point of the interceptor/decorator mechanism is to
 * stay generic across resource types (BAC-8's AC3).
 */
export interface AuditLogEntry {
  id: string;
  /**
   * `null` when the mutation was performed by a caller with no verified
   * access-token identity -- currently true for BOTH `POST /tenants` (there
   * is no tenant to authenticate against yet during onboarding) and
   * `POST /items` (this service does not yet require `AccessTokenGuard` on
   * that route). Recorded honestly as `null` rather than a fabricated
   * value; once a route is guarded by `AccessTokenGuard`, the interceptor
   * captures the real `userId` here (proven by `AuditLogInterceptor`'s
   * unit tests).
   */
  actorUserId: string | null;
  /** Semantic action name derived from the HTTP method -- see `resolveAuditAction`. */
  action: string;
  /** The resource-type string passed to `@Audited(...)`, e.g. `'tenant'`, `'item'`. */
  resourceType: string;
  /** `null` if the mutated resource's response body has no discoverable id. */
  resourceId: string | null;
  /**
   * Pre-mutation snapshot, or `null` for a creation (there is no "before" a
   * resource exists -- AC1/AC4's honesty requirement: never fabricate one).
   */
  before: unknown;
  /** Post-mutation snapshot: the mutation's response body. */
  after: unknown;
  createdAt: Date;
}
