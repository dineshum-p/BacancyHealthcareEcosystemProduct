export type TenantId = string;

/**
 * Roles a user can hold within a tenant (BAC-7; replaces BAC-5's single
 * placeholder value `'member'`). Registration default (`POST /auth/register`)
 * is `'staff'` -- the least-privileged role -- EXCEPT for the very first
 * user registered for a given tenant, who is automatically assigned
 * `'super_admin'` (the bootstrap-admin resolution; see `services/auth`'s
 * `AuthService.register`). There is no separate seeding/admin-invite flow.
 */
export type UserRole = 'super_admin' | 'clinic_admin' | 'provider' | 'staff';

/**
 * Permissions checked by `services/auth`'s `PermissionsGuard` (BAC-7) and
 * `services/emr`'s own copy of the same mechanism (BAC-10) against the
 * caller's `role` claim. `'read_patient'`/`'write_patient'` were added by
 * BAC-10 -- see `services/emr`'s `permission.enum.ts` for what each grants
 * access to.
 */
export type Permission =
  | 'manage_user_roles'
  | 'view_users'
  | 'read_patient'
  | 'write_patient';

/** One entry of `GET /auth/roles`'s response body (BAC-7, AC1). */
export interface RoleDefinition {
  role: UserRole;
  permissions: Permission[];
}

/**
 * Request body for `POST /auth/admin-seed` (BAC-12): the internal,
 * service-to-service counterpart to `POST /auth/register` used by
 * `services/tenant`'s onboarding orchestration to seed a tenant's first
 * `clinic_admin` without requiring that admin to already have chosen a
 * password (an invite flow, not self-service registration). See
 * `services/auth`'s `AuthController`/`InternalServiceGuard` for why this is
 * a separate endpoint rather than a reuse of `POST /auth/register`.
 */
export interface AdminSeedRequest {
  email: string;
}

/**
 * Claims signed into every access-token JWT issued by `services/auth`
 * (BAC-5, AC5). Shared with `apps/web` so the frontend can type-check
 * anything it decodes from a stored access token without redefining the
 * contract on its side (per CLAUDE.md's FE/BE shared-types rule).
 */
export interface AccessTokenPayload {
  userId: string;
  tenantId: TenantId;
  role: UserRole;
}

/** Response body for `POST /auth/register` (BAC-5, AC1). */
export interface RegisteredUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/** Response body for `POST /auth/login` (BAC-5, AC2). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime, in seconds. */
  expiresIn: number;
}

/** Response body for `POST /auth/refresh` (BAC-5, AC4). */
export interface AccessTokenResponse {
  accessToken: string;
  /** Access token lifetime, in seconds. */
  expiresIn: number;
}

/**
 * MFA lifecycle for a user (BAC-6). Mirrors `services/auth`'s
 * `MfaStatus` enum: `none` (default) -> `pending` (enrolled, unverified)
 * -> `active` (enforced at login).
 */
export type MfaStatus = 'none' | 'pending' | 'active';

/** Response body for `POST /auth/mfa/enroll` (BAC-6, AC1). */
export interface MfaEnrollment {
  /** Base32 TOTP secret, shown once for manual entry into an authenticator app. */
  secret: string;
  /** `otpauth://` URI an authenticator app can scan as a QR code. */
  otpauthUrl: string;
}

/**
 * Response body for `POST /auth/mfa/verify` (BAC-6, AC2) -- activates MFA
 * and returns recovery codes. The raw codes are returned exactly ONCE, in
 * this response; the server persists only their hashes and can never
 * redisplay the raw values again.
 */
export interface MfaActivation {
  recoveryCodes: string[];
}

/**
 * Returned by `POST /auth/login` (BAC-6, AC3) instead of `AuthTokens` when
 * the account's MFA is `active`. `mfaChallengeToken` is single-purpose and
 * short-lived; exchange it (with a valid TOTP code) via
 * `POST /auth/mfa/login-verify` for real `AuthTokens`. It is NOT a bearer
 * access token and must not be sent as one.
 */
export interface MfaChallenge {
  mfaRequired: true;
  mfaChallengeToken: string;
}

/** `POST /auth/login`'s response is one of these two shapes (BAC-6, AC3). */
export type LoginResult = AuthTokens | MfaChallenge;

/**
 * `services/notification` (BAC-9). Channels a notification can be dispatched
 * over -- kept deliberately small (no `push`/`webhook`/etc.) to match this
 * ticket's scope; see that service's `NotificationProviderAdapter` port for
 * how a channel maps to a concrete SMS/email vendor adapter.
 */
export type NotificationChannel = 'sms' | 'email';

/**
 * Delivery lifecycle for a notification (BAC-9, AC2/AC3): `queued` on
 * creation (before the async send is attempted), `sent` once the provider
 * adapter confirms delivery, `failed` only once every retry attempt (with
 * backoff) has been exhausted.
 */
export type NotificationStatus = 'queued' | 'sent' | 'failed';

/** Request body for `POST /notifications` (BAC-9, AC1). */
export interface CreateNotificationRequest {
  channel: NotificationChannel;
  to: string;
  templateId: string;
  /**
   * Values substituted into the named template's `{{variable}}`
   * placeholders. Deliberately a flat string-keyed record, not `unknown`
   * nested structures -- see `renderTemplate`'s doc comment for why template
   * interpolation is treated as untrusted-input-into-output.
   */
  data?: Record<string, string>;
}

/**
 * Response body for both `POST /notifications` (AC1) and
 * `GET /notifications/:id` (AC2). `status`/`providerMessageId`/`attempts`/
 * `lastError` reflect the CURRENT state at the time of the request --
 * `POST /notifications` returns this immediately with `status: 'queued'`
 * (delivery, including retries, happens asynchronously; see that service's
 * README for the full design), while a subsequent `GET` may show `sent` or
 * `failed`.
 */
export interface NotificationResponse {
  id: string;
  channel: NotificationChannel;
  to: string;
  templateId: string;
  status: NotificationStatus;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload shape this service's domain-event consumer expects for a
 * `user.registered` event (BAC-9, AC4). No service in this repo publishes
 * this event onto a real broker yet (`services/auth` does not emit it) --
 * this type documents the CONTRACT the mapping logic
 * (`UserRegisteredEventHandler`) is written against, so a future publisher
 * has a concrete shape to produce. See
 * `services/notification/src/notifications/events/README.md` for the full
 * scope boundary.
 */
export interface UserRegisteredEvent {
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
}

/**
 * `services/emr` (BAC-10). A minimal subset of the FHIR R4 `HumanName`
 * datatype -- just enough to name a `Patient` -- not the full FHIR
 * specification's element set (e.g. `period`, `prefix`/`suffix` are
 * deliberately omitted; a future ticket can extend this if a real need
 * arises).
 */
export interface FhirHumanName {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
}

/** FHIR R4 `Identifier` datatype subset (BAC-10), e.g. an MRN or SSN. */
export interface FhirIdentifier {
  system?: string;
  value: string;
  use?: string;
}

/** FHIR R4 `ContactPoint` datatype subset (BAC-10), e.g. a phone or email. */
export interface FhirContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: string;
}

/** FHIR R4 `Address` datatype subset (BAC-10). */
export interface FhirAddress {
  use?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * A FHIR R4 `Patient` resource, as served/accepted by `services/emr`'s
 * `/fhir/Patient` gateway (BAC-10, AC1/AC2). Deliberately a subset of the
 * full FHIR R4 `Patient` resource (e.g. no `contact`/`communication`/
 * `generalPractitioner`/`managingOrganization` -- those are out of this
 * ticket's scope and can be added by a later ticket without breaking this
 * contract, since every field here is either required by FHIR itself
 * (`resourceType`) or additive).
 */
export interface FhirPatientResource {
  resourceType: 'Patient';
  id?: string;
  active?: boolean;
  identifier?: FhirIdentifier[];
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: FhirAddress[];
}

/**
 * A FHIR R4 `OperationOutcome` resource (BAC-10, AC3): the shape every
 * malformed/non-R4-conformant `/fhir/*` request is rejected with instead of
 * a generic Nest/HTTP error body, so FHIR clients can parse errors the same
 * way they parse any other FHIR resource.
 */
export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: FhirOperationOutcomeIssue[];
}

export interface FhirOperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  /** A FHIR `IssueType` code, e.g. `'invalid'`, `'structure'`, `'required'`. */
  code: string;
  diagnostics?: string;
}

/**
 * Payload shape a FUTURE domain-event publisher would produce when a FHIR
 * `Patient` resource is created (BAC-10). Mirrors `UserRegisteredEvent`'s
 * documented-contract-with-no-real-publisher convention exactly: **no
 * service in this repo publishes this event onto a real broker today** --
 * `services/emr`'s `PatientsService` does not emit it, and there is no
 * Kafka producer anywhere in this repo/sandbox (see
 * `services/notification/src/notifications/events/README.md` for why no
 * ticket has wired one up yet). This type exists so a future
 * publisher/consumer pair has a concrete, shared contract to build against,
 * per this ticket's explicit instruction not to invent a new event-bus
 * mechanism where none exists yet.
 */
export interface PatientCreatedEvent {
  patientId: string;
  tenantId: string;
  /** ISO-8601 timestamp of creation. */
  createdAt: string;
}

/**
 * `services/billing` (BAC-11). The closed set of billable metrics this
 * service meters. Deliberately a small string-literal union (not an open
 * `string`) so a typo in a future publisher is caught at compile time --
 * extend this union (and `services/billing`'s plan-limits map) when a new
 * billable domain event is added.
 */
export type MeteredMetric = 'patient.created' | 'encounter.created';

/**
 * Payload shape a FUTURE domain-event publisher would produce for a billable
 * usage event (BAC-11, AC1). Mirrors `UserRegisteredEvent`'s (BAC-9) and
 * `PatientCreatedEvent`'s (BAC-10) documented-contract-with-no-real-publisher
 * convention exactly: **no service in this repo publishes this event onto a
 * real broker today** -- e.g. `services/emr`'s `PatientsService` does not
 * emit a `patient.created` usage event, and there is no Kafka producer
 * anywhere in this repo/sandbox wiring one up (see
 * `services/notification/src/notifications/events/README.md` for the
 * established scope boundary this ticket follows). This type exists so a
 * future publisher and `services/billing`'s consumption-side ingestion
 * method/endpoint have a concrete, shared contract to build against.
 *
 * Deliberately carries only a tenant-scoped metric/quantity/timestamp --
 * NEVER a patient name, MRN, or other identifying detail -- so a usage
 * record can never itself become a PHI/PII store. See
 * `services/billing/src/usage/usage-events.repository.ts`'s doc comment for
 * the full design rationale.
 */
export interface MeteredDomainEvent {
  /**
   * Idempotency key: the domain event's own id. Recording the SAME
   * `eventId` twice must not double-count usage (BAC-11, AC3).
   */
  eventId: string;
  tenantId: string;
  metric: MeteredMetric;
  /** Number of billable units this single event represents; almost always `1`. */
  quantity: number;
  /**
   * ISO-8601 timestamp of when the underlying domain event occurred (used
   * to bucket usage into a billing period) -- NOT when it was recorded/
   * ingested by `services/billing`.
   */
  occurredAt: string;
}

/** One metric's aggregated total for a billing period (BAC-11, AC2/AC4). */
export interface UsageMetricTotal {
  metric: MeteredMetric;
  /** Sum of `quantity` across every non-duplicate recorded event for this metric within the period. */
  quantity: number;
  /** The tenant's plan-defined limit for this metric, or `null` if the metric has no configured limit for that plan. */
  limit: number | null;
  /** `true` once `quantity` has met or exceeded `limit` (BAC-11, AC4). Always `false` when `limit` is `null`. */
  limitExceeded: boolean;
}

/** Response body for `GET /billing/usage` (BAC-11, AC2). */
export interface UsageSummaryResponse {
  tenantId: string;
  /** The billing period this summary covers, `YYYY-MM` (calendar month, UTC). */
  period: string;
  metrics: UsageMetricTotal[];
}

/** Response body for `POST /billing/usage/events` (BAC-11, AC1/AC3). */
export interface UsageEventResponse {
  /** Server-assigned internal record id (distinct from `eventId`, the caller-supplied idempotency key). */
  id: string;
  eventId: string;
  tenantId: string;
  metric: MeteredMetric;
  quantity: number;
  occurredAt: string;
  /** When `services/billing` persisted this record (ingestion time, not `occurredAt`). */
  recordedAt: string;
}

/** `services/tenant` (BAC-3/BAC-12). Lifecycle status of a tenant registry row. */
export type TenantStatus = 'pending' | 'active' | 'inactive';

/**
 * Outcome of one step of BAC-12's onboarding orchestration
 * (`POST /tenants/onboard`): `'succeeded'`/`'failed'` reflect a real attempt;
 * `'skipped'` means a prior step in the chain failed first, so this step was
 * deliberately never attempted (see `services/tenant`'s `OnboardingService`
 * doc comment for the full partial-failure policy).
 */
export type ProvisioningStepStatus = 'succeeded' | 'failed' | 'skipped';

/**
 * A tenant as returned by `services/tenant`'s `POST /tenants`,
 * `GET /tenants/:id`, `GET /tenants` (BAC-3/BAC-4), and `POST /tenants/onboard`
 * (BAC-12). `adminSeedStatus`/`inviteStatus` are `null` for a tenant that was
 * never onboarded via `POST /tenants/onboard` (e.g. created via the plain
 * `POST /tenants` bootstrap endpoint) -- there is no provisioning-result
 * outcome to report for those. Deliberately omits `ownerEmail` -- see that
 * service's `tenant-response.dto.ts` for why leaking it on any tenant
 * -returning response would undermine BAC-7's bootstrap-admin design.
 */
export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: TenantStatus;
  schemaName: string;
  adminSeedStatus: ProvisioningStepStatus | null;
  inviteStatus: ProvisioningStepStatus | null;
}

/**
 * Request body for `POST /tenants/onboard` (BAC-12, AC1/AC2): a Super Admin
 * console submission that provisions a brand-new tenant, seeds its first
 * `clinic_admin` (`adminEmail`), and sends that admin an invite notification,
 * in one orchestrated call.
 */
export interface OnboardTenantRequest {
  name: string;
  slug: string;
  plan: string;
  adminEmail: string;
}

/**
 * Response body for `POST /tenants/onboard` (BAC-12, AC1/AC2/AC3): the
 * created tenant plus the outcome of each downstream orchestration step, so
 * the Super Admin console can render the result immediately without a
 * separate poll, and the same per-step statuses are persisted onto the
 * tenant row (`TenantSummary.adminSeedStatus`/`inviteStatus`) for the tenant
 * list page to display later.
 */
export interface OnboardTenantResponse {
  tenant: TenantSummary;
  adminSeed: { status: ProvisioningStepStatus; message?: string };
  invite: { status: ProvisioningStepStatus; message?: string };
}
