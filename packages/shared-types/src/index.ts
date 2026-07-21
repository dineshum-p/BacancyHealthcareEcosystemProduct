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
 * access to. `'read_encounter'`/`'write_encounter'` were added by BAC-15 for
 * that same service's SOAP encounter-note endpoints. `'read_appointments'`/
 * `'manage_appointments'` were added by BAC-16/BAC-21 -- see
 * `services/scheduling`'s own `permission.enum.ts` (a separately-deployed
 * service, so it necessarily duplicates the string values rather than
 * importing this union) for what each grants access to; `apps/web`'s BAC-21
 * appointments UI (`rolePermissions.ts`) is the only frontend consumer.
 */
export type Permission =
  | 'manage_user_roles'
  | 'view_users'
  | 'read_patient'
  | 'write_patient'
  | 'read_encounter'
  | 'write_encounter'
  | 'review_patient_self_registration'
  | 'read_appointments'
  | 'manage_appointments';

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
 * Payload published when a patient is registered. Originally documented by
 * BAC-10 (`services/emr`) as a contract-with-no-real-publisher (that
 * service's FHIR `PatientsService` never emitted it, and there was no Kafka
 * producer anywhere in this repo/sandbox yet). **BAC-14 (`services/patient`)
 * is the real publisher**: `PatientsService.create` calls
 * `DomainEventPublisher.publishPatientCreated` with exactly this shape after
 * every successful `POST /patients` (AC4), reusing
 * `services/notification`'s BAC-9 `kafkajs`-backed adapter convention on the
 * producing side (`services/patient/src/events/kafka-event-publisher.adapter.ts`).
 * The concrete transport is only a real Kafka broker when an operator
 * explicitly sets `KAFKA_PRODUCER_ENABLED=true` (defaults to `false`
 * everywhere, including production, since no real broker is provisioned in
 * this repo/sandbox) -- see that service's `events/` directory doc comments
 * for the full scope boundary. `services/billing`'s usage-metering consumer
 * (BAC-11/S9) is the intended future subscriber; wiring that consumption is
 * explicitly out of THIS ticket's scope.
 */
export interface PatientCreatedEvent {
  /**
   * Idempotency key for a downstream at-least-once consumer (e.g. a future
   * `services/billing` BAC-11 usage-metering consumer). MUST be a stable,
   * reusable value -- this event's own `patientId` -- and NOT a freshly
   * generated UUID per publish; a fresh UUID on every (re)delivery would
   * defeat dedup on redelivery, since the same underlying `patient.created`
   * occurrence would be recorded as a distinct event each time. Maps onto
   * `MeteredDomainEvent.eventId` unchanged. See `PatientsService.create`,
   * the real publisher of this event, for where `eventId` is set to
   * `record.id` (the same value as `patientId`).
   *
   * The rest of this event maps onto `MeteredDomainEvent` as: `createdAt`
   * -> `occurredAt` (the metered event's `occurredAt` is this event's
   * `createdAt`, NOT the time billing ingests it); a future publisher would
   * set `metric: 'patient.created'` and `quantity: 1`. Wiring that mapping
   * is still out of this ticket's scope -- see this file's
   * `MeteredDomainEvent` doc comment -- but the shape here is compatible
   * with it today.
   */
  eventId: string;
  patientId: string;
  tenantId: string;
  /** ISO-8601 timestamp of creation. */
  createdAt: string;
}

/**
 * `services/patient` (BAC-14). Sex/gender as recorded on intake --
 * deliberately a small closed set (mirrors FHIR's own `AdministrativeGender`
 * code system already reused by `services/emr`'s BAC-10
 * `FhirPatientResource.gender`, without requiring full FHIR conformance in
 * this plain-REST registration/search service).
 */
export type PatientGender = 'male' | 'female' | 'other' | 'unknown';

/** Request body for `POST /patients` (BAC-14, AC1). */
export interface RegisterPatientRequest {
  firstName: string;
  lastName: string;
  /** ISO-8601 date (`YYYY-MM-DD`), no time component. */
  dateOfBirth: string;
  gender?: PatientGender;
  phone?: string;
  email?: string;
}

/**
 * A patient as returned by `services/patient`'s `POST /patients` and
 * `GET /patients` (BAC-14, AC1/AC3). `mrn` is tenant-unique and sequential
 * (AC1/AC2) -- see that service's `patients/patients.repository.ts` for the
 * per-tenant-schema counter mechanism that guarantees it.
 */
export interface PatientSummary {
  id: string;
  tenantId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  /** ISO-8601 date (`YYYY-MM-DD`). */
  dateOfBirth: string;
  gender: PatientGender | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /patients` query params (BAC-14, AC3): search by name, MRN, and/or date of birth, paginated. */
export interface PatientSearchQuery {
  /** Matches against either the first or last name (partial, case-insensitive). */
  name?: string;
  /** Matches against the MRN (partial, case-insensitive). */
  mrn?: string;
  /** Exact match, ISO-8601 date (`YYYY-MM-DD`). */
  dateOfBirth?: string;
  page?: number;
  limit?: number;
}

/** `GET /patients`'s paginated response body (BAC-14, AC3). */
export interface PaginatedPatientsResponse {
  items: PatientSummary[];
  page: number;
  limit: number;
  total: number;
}

/**
 * `services/emr` (BAC-15). A structured SOAP encounter note --
 * Subjective/Objective/Assessment/Plan -- all free-text fields. Deliberately
 * plain clinical-charting text fields, not a FHIR `Observation`/
 * `Composition` resource (out of this ticket's scope, unlike BAC-10's FHIR
 * `Patient` gateway); a future ticket can layer FHIR conformance on top
 * without breaking this contract.
 */
export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/**
 * `services/emr` (BAC-15). Vitals captured alongside a SOAP note. Every
 * field is optional (a provider may not capture every vital at every visit)
 * but, WHEN PRESENT, is validated against a plausible clinical range by
 * that service's `CreateEncounterDto` (class-validator) -- see that DTO for
 * the exact bounds. Units: `heartRate` beats/minute,
 * `bloodPressureSystolic`/`bloodPressureDiastolic` mmHg, `temperature`
 * degrees Celsius, `respiratoryRate` breaths/minute, `spO2` percent oxygen
 * saturation.
 */
export interface VitalSigns {
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  respiratoryRate?: number;
  spO2?: number;
}

/** `services/emr` (BAC-15). Clinical severity of a recorded allergy reaction. */
export type AllergySeverity = 'mild' | 'moderate' | 'severe';

/** `services/emr` (BAC-15). One structured allergy entry captured on an encounter. */
export interface Allergy {
  substance: string;
  reaction?: string;
  severity?: AllergySeverity;
}

/** Request body for `POST /patients/:patientId/encounters` (BAC-15, AC1). */
export interface CreateEncounterRequest {
  soapNote: SoapNote;
  vitals?: VitalSigns;
  allergies?: Allergy[];
}

/**
 * An encounter as returned by `services/emr`'s
 * `POST /patients/:patientId/encounters` and
 * `GET /patients/:patientId/encounters` (BAC-15, AC1/AC2). `vitals` is
 * `null` when none of the optional vitals fields were captured for this
 * encounter.
 */
export interface EncounterSummary {
  id: string;
  tenantId: string;
  patientId: string;
  soapNote: SoapNote;
  vitals: VitalSigns | null;
  allergies: Allergy[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload published when a SOAP encounter note is saved (BAC-15, AC4).
 * `services/emr`'s `EncountersService.create` calls
 * `DomainEventPublisher.publishEncounterCreated` with exactly this shape
 * after every successful `POST /patients/:patientId/encounters`, reusing
 * `services/patient`'s BAC-14 `DomainEventPublisher`/
 * `KafkaEventPublisherAdapter`/`NoopDomainEventPublisher` convention on the
 * producing side (`KAFKA_PRODUCER_ENABLED=true` gated; a no-op default
 * everywhere else, since no real broker is provisioned in this
 * repo/sandbox).
 *
 * This is NOT a `MeteredDomainEvent` and is not presented as one: it has no
 * `metric`/`quantity`/`occurredAt`, and it deliberately DOES carry
 * `patientId`/`encounterId` -- identifying details `MeteredDomainEvent`'s own
 * doc comment says a usage record must NEVER contain. Any future
 * `services/billing` consumer needs a translation/mapping layer between the
 * two shapes, not a direct cast. That mapping would be:
 * `MeteredDomainEvent.eventId` <- this event's `eventId` (already the
 * encounter's own id, a stable idempotency key -- reuse it as-is),
 * `occurredAt` <- this event's `createdAt`, `metric` <- the fixed constant
 * `'encounter.created'` (see `MeteredMetric`), `quantity` <- `1`. `tenantId`
 * carries over directly; `patientId`/`encounterId` are simply dropped by the
 * mapping (never forwarded to billing).
 *
 * Note on BAC-14: `PatientCreatedEvent` (this file, above) is BAC-14's
 * analogous domain event and, as of this writing, it ALSO does not match
 * `MeteredDomainEvent`'s shape and has never been reconciled against it --
 * `services/billing`'s usage-metering endpoint only accepts `MeteredDomainEvent`
 * directly (see `services/billing/src/usage/usage.service.ts`), and no code
 * in this repo maps `PatientCreatedEvent` to it. Do not assume otherwise
 * when reusing this convention for a future event.
 */
export interface EncounterCreatedEvent {
  /** Idempotency key: reused as the encounter's own id (see mapping note above). */
  eventId: string;
  encounterId: string;
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
  /**
   * The product modules this tenant has been granted access to (PRD Section
   * 3/6). Selected at onboarding time; drives both feature access and the
   * subscription pricing computed for the tenant. May be empty for tenants
   * created via the plain `POST /tenants` bootstrap endpoint, which predates
   * module selection.
   */
  modules: HepModule[];
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
  /** Subscription tier the tenant is onboarding onto (drives the monthly platform base fee). */
  plan: PlanTier;
  /** The product modules the tenant is subscribing to (at least one). */
  modules: HepModule[];
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

/**
 * The five product modules a tenant can subscribe to (PRD Section 3). A
 * tenant is granted access to the modules it selects at onboarding; the
 * selection also drives its subscription pricing (PRD Section 6). These are
 * the CONTRACT identifiers only -- the authoritative fee schedule and the
 * quote calculation live server-side in `services/tenant`'s pricing module
 * (there is no real fee data on the client), exposed via `GET /pricing/quote`.
 */
export type HepModule =
  | 'clinic'
  | 'pharmacy'
  | 'doctor'
  | 'insurance'
  | 'patient_portal';

/**
 * Subscription tier (PRD Section 6.2, "Platform base"): sets the flat monthly
 * platform fee, independent of which modules are selected.
 */
export type PlanTier = 'starter' | 'growth' | 'enterprise';

/** Request for a pricing quote (`GET /pricing/quote`): the tenant's intended module selection + tier. */
export interface PricingQuoteRequest {
  modules: HepModule[];
  planTier: PlanTier;
}

/** One selected module's contribution to a quote (PRD Section 6.1/6.2). */
export interface PricingLineItem {
  module: HepModule;
  label: string;
  /** One-time onboarding fee for this module (PRD Section 6.1, first-time fee). */
  onboardingFee: number;
  /** Human-readable billable unit for this module's usage charge, e.g. "e-prescription". */
  usageUnit: string;
  /** Per-unit usage rate range across volume tiers (PRD Section 6.2): high-volume `to` <= low-volume `from`. */
  usageRateFrom: number;
  usageRateTo: number;
}

/**
 * A computed subscription quote (`GET /pricing/quote`, PRD Section 6). All
 * monetary values are in whole USD. The multi-module discount (PRD 6.1)
 * applies to the combined one-time onboarding fee only, never to the monthly
 * platform fee or usage rates.
 */
export interface PricingQuote {
  modules: HepModule[];
  planTier: PlanTier;
  lineItems: PricingLineItem[];
  /** Sum of every selected module's onboarding fee, before discount. */
  onboardingSubtotal: number;
  /** Multi-module discount rate applied to the onboarding subtotal: 0, 0.05, 0.10, 0.15, or 0.25. */
  discountRate: number;
  /** `onboardingSubtotal * discountRate`. */
  discountAmount: number;
  /** One-time onboarding total the tenant actually pays: `onboardingSubtotal - discountAmount`. */
  onboardingTotal: number;
  /** Flat recurring monthly platform fee for the chosen tier (PRD 6.2). */
  monthlyPlatformFee: number;
}

/**
 * `services/patient` (BAC-36). Request body for the PUBLIC, unauthenticated
 * `POST /public/tenants/:tenantSlug/patients` endpoint: a patient submitting
 * their own registration online, without an in-person identity check. Same
 * shape as `RegisterPatientRequest` (BAC-14's staff-driven counterpart) --
 * self-registration collects the same core demographics, just through a
 * different (unauthenticated, pending-review) intake path.
 */
export type SelfRegisterPatientRequest = RegisterPatientRequest;

/**
 * Lifecycle of a self-submitted registration (BAC-36): `pending` immediately
 * after submission (not yet searchable/trusted); `approved` once staff
 * confirm it as a genuinely new patient (a real `patients` row -- with an
 * MRN -- is created at that point); `rejected` when staff determine it is
 * not legitimate; `merged` when staff determine it duplicates an existing
 * patient and link it to that patient's record instead of creating a new
 * one.
 */
export type PatientSelfRegistrationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'merged';

/**
 * Response body for `POST /public/tenants/:tenantSlug/patients` (BAC-36).
 * Deliberately minimal -- it must NOT leak whether a probable-duplicate match
 * was found (that is staff-only information, see
 * `PatientSelfRegistrationSummary.matchedPatientId`) to the anonymous public
 * caller.
 */
export interface SelfRegistrationReceipt {
  id: string;
  tenantId: string;
  status: PatientSelfRegistrationStatus;
  createdAt: string;
}

/**
 * A pending (or reviewed) self-registration as seen by staff reviewing the
 * queue (BAC-36): `GET /patients/self-registrations`. `matchedPatientId`/
 * `matchReason` are populated by duplicate detection at submission time --
 * "this looks like it might be an existing patient" -- and are non-null only
 * when a probable match was found; they do NOT auto-create/link anything by
 * themselves, they only inform the staff reviewer's approve/reject/merge
 * decision. `resultingPatientId` is set once reviewed: the newly created
 * `patients` row on approval, or the matched existing patient's id on merge;
 * always `null` while `status` is `'pending'` or after `'rejected'`.
 */
export interface PatientSelfRegistrationSummary {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  /** ISO-8601 date (`YYYY-MM-DD`). */
  dateOfBirth: string;
  gender: PatientGender | null;
  phone: string | null;
  email: string | null;
  status: PatientSelfRegistrationStatus;
  matchedPatientId: string | null;
  /** Why `matchedPatientId` was flagged, e.g. `'name_dob'`, `'phone'`, `'email'`. */
  matchReason: string | null;
  resultingPatientId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request body for `POST /patients/self-registrations/:id/reject` (BAC-36). */
export interface RejectSelfRegistrationRequest {
  reason?: string;
}

/**
 * Request body for `POST /patients/self-registrations/:id/merge` (BAC-36):
 * staff confirming the self-registration IS the same person as an existing
 * patient. `targetPatientId` defaults to the duplicate-detection candidate
 * (`PatientSelfRegistrationSummary.matchedPatientId`) on the client, but
 * staff may override it to point at a different existing patient than the
 * one duplicate detection proposed.
 */
export interface MergeSelfRegistrationRequest {
  targetPatientId: string;
}

/**
 * `services/scheduling` (BAC-16). Lifecycle of a single-provider appointment
 * slot: `booked` on creation, `cancelled` once cancelled. There is no
 * separate `rescheduled` value -- a reschedule keeps `status: 'booked'` and
 * simply updates `startTime`/`endTime` (the status TRANSITION -- old
 * time range -> new time range, or `booked` -> `cancelled` -- is what gets
 * recorded in the audit log, per `PATCH /appointments/:id`'s AC). Deliberately
 * only these two values: this ticket explicitly excludes recurring
 * appointments and cross-provider conflict/resource allocation, so there is
 * no `no-show`/`completed`/etc. lifecycle to model yet.
 */
export type AppointmentStatus = 'booked' | 'cancelled';

/**
 * Request body for `POST /appointments` (BAC-16, AC1): books a single slot
 * for one patient with one provider. `notifyChannel`/`notifyTo` carry the
 * patient's confirmation-delivery destination (an email address or phone
 * number) -- `services/scheduling` does not itself store patient contact
 * details (that's `services/patient`'s (BAC-14) data), so the caller (which
 * already has the patient record on screen, e.g. from a prior
 * `GET /patients` search) supplies where the booking confirmation
 * (`services/notification`, BAC-9) should be sent.
 */
export interface CreateAppointmentRequest {
  /** The user id (JWT `sub`/`userId`) of the provider this slot is booked with. */
  providerId: string;
  /** `services/patient`'s (BAC-14) patient id. */
  patientId: string;
  /** ISO-8601 date-time; start of the slot. */
  startTime: string;
  /** ISO-8601 date-time; end of the slot. Must be after `startTime`. */
  endTime: string;
  notifyChannel: NotificationChannel;
  /** Email address or phone number, matching `notifyChannel`. */
  notifyTo: string;
}

/**
 * An appointment as returned by every `services/scheduling` endpoint
 * (BAC-16): `POST /appointments`, `GET /appointments`,
 * `PATCH /appointments/:id`.
 */
export interface AppointmentSummary {
  id: string;
  tenantId: string;
  providerId: string;
  patientId: string;
  /** ISO-8601 date-time. */
  startTime: string;
  /** ISO-8601 date-time. */
  endTime: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

/** `GET /appointments` query params (BAC-16, AC2): a single calendar day's schedule. */
export interface AppointmentQuery {
  /** ISO-8601 date (`YYYY-MM-DD`), no time component -- the calendar day (UTC) to list. */
  date: string;
  /**
   * Required for `clinic_admin`/`staff` (who may query any provider's day);
   * ignored (always resolves to the caller's own user id) for `provider`,
   * who may only view their own calendar. See `services/scheduling`'s
   * `provider-scope.util.ts`.
   */
  providerId?: string;
}

/**
 * Request body for `PATCH /appointments/:id` (BAC-16, AC3): either
 * reschedules a booked appointment to a new time range, or cancels it.
 * `startTime`/`endTime` are required when (and only meaningful when)
 * `action` is `'reschedule'`.
 */
export interface UpdateAppointmentRequest {
  action: 'reschedule' | 'cancel';
  /** ISO-8601 date-time; required when `action` is `'reschedule'`. */
  startTime?: string;
  /** ISO-8601 date-time; required when `action` is `'reschedule'`. */
  endTime?: string;
}
