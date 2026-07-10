<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## Notifications: SMS/email dispatch via provider adapters (BAC-9)

This service sends SMS and email notifications through a pluggable
`NotificationProviderAdapter` port, tracks delivery status through to a
terminal `sent`/`failed` outcome with retry-with-backoff, and consumes a
`user.registered` domain event to send a welcome notification.

### Endpoints

- `POST /notifications` -- `{ channel: 'sms'|'email', to, templateId, data? }`.
  Renders the named template, persists a `queued` row, and returns
  `{ id, status: 'queued', ... }` immediately (201). Delivery -- including
  any retries -- happens asynchronously afterward; the response never
  blocks on it.
- `GET /notifications/:id` -- the current `status`/`attempts`/
  `providerMessageId`/`lastError` for a notification, scoped to the
  caller's tenant.

Both routes are guarded by `TenantGuard` (`X-Tenant-Id` header; 404 unknown
tenant, 403 inactive tenant -- mirrors `services/tenant`'s BAC-8 pattern)
-> `AccessTokenGuard` (`Bearer <access-token>`, verified against the SAME
`JWT_ACCESS_SECRET` `services/auth` signs with; this service never issues
tokens itself). **Auth/scoping decision**: an unauthenticated "send
arbitrary SMS/email" endpoint is a real abuse/cost vector (spam, phishing
using the tenant's identity), so `POST /notifications` requires proof of
some valid platform user. `GET` is guarded the same way for consistency,
since it exposes tenant-scoped delivery data.

### Provider adapters (AC1, AC3)

`NotificationProviderAdapter` (`src/notifications/providers/`) is the port:
`send(channel, to, renderedContent): Promise<{outcome:'sent',providerMessageId}|{outcome:'failed',error}>`.

- `FakeNotificationProviderAdapter` -- in-process, no network calls,
  configurable to always succeed, always fail, or fail N times then
  succeed. **This is the only adapter this repo's automated tests are ever
  allowed to exercise** -- no real Twilio/SendGrid credentials exist in
  this environment, and this pipeline must never send a real SMS/email
  during automated implementation or testing.
- `TwilioSmsProviderAdapter` / `SendGridEmailProviderAdapter` -- real,
  production-shaped adapters calling the actual vendor HTTP APIs (request/
  response shapes match the real APIs), built for production-readiness.
  Their own tests inject a fetch mock and never touch the network either.
- `provider-adapter.module.ts` wires a `NOTIFICATION_PROVIDER_ADAPTER`
  token that defaults to the **fake** adapter in every environment --
  including production -- until an operator explicitly sets
  `NOTIFICATION_PROVIDER_MODE=real` with real Twilio/SendGrid credentials
  configured. This is a deliberate fail-**safe** default (the inverse of
  this codebase's usual fail-fast-on-insecure-default pattern from
  BAC-5/6/8): the risk here is an accidental real SMS/email send, not a
  silently-insecure secret.

Template rendering (`src/notifications/templates/render-template.util.ts`)
is minimal `{{variable}}` string substitution against the caller-supplied
`data` object -- no `eval`, no templating-engine code execution -- since
`data` is effectively untrusted-input-into-output (interpolated into a
message body sent to a real person). `template-registry.ts` is a small,
hand-maintained `templateId -> template` map; there is no
template-management CRUD API (out of this ticket's scope).

### Async delivery + retry-with-backoff (AC2, AC3)

`POST /notifications` persists a `queued` row and returns immediately;
`NotificationDeliveryWorker.deliver()` runs fire-and-forget afterward (no
Redis/BullMQ or other job-queue infrastructure exists anywhere in this
repo yet -- this is a Phase-0-appropriate in-process implementation; a
real queue is the natural upgrade path once one exists). Status
transitions: `queued -> sent` (with `providerMessageId`) on the first
successful attempt, or `queued -> failed` (with the last error) only once
`NOTIFICATION_MAX_ATTEMPTS` attempts are exhausted -- nothing in between is
externally observable via `GET /notifications/:id`. Backoff between
attempts is exponential: `NOTIFICATION_BACKOFF_BASE_MS * 2^(attempt-1)`.
Both are configurable via env, with sane defaults (3 attempts, 200ms base).

### Domain event consumption (AC4) -- scope boundary

`UserRegisteredEventHandler` maps a `user.registered` event
(`@hep/shared-types`' `UserRegisteredEvent`) to a welcome-email
notification-send call, resolving the event's `tenantId` directly via a
read-only mirror of `public.tenants` and calling
`NotificationsService.createForSchema` directly -- bypassing
`NotificationsController`/`TenantGuard`/`AccessTokenGuard` entirely, since
this is a non-HTTP trigger with no bearer token or `X-Tenant-Id` header to
check. `KafkaEventConsumerAdapter` is a real, `kafkajs`-backed adapter, but
**no real Kafka broker exists anywhere in this repo/sandbox**, so it is
never started automatically -- `KAFKA_CONSUMER_ENABLED` defaults to
`false` everywhere. **`services/auth` does not publish this event to any
real broker either** -- wiring a real producer is a separate,
cross-service, infrastructure-dependent follow-up ticket. See
`src/notifications/events/README.md` for the full detail.

### Tenant scoping

Like `services/auth`, this service holds a read-only mirror of the shared
`public.tenants` registry (`src/tenants/`) and never provisions tenants
itself. Its own domain table, `<tenant_schema>.notifications`, is created
lazily/idempotently per tenant by `NotificationsSchemaProvisioner` the
first time it's needed -- see `migrations/README.md` for why this is not a
static migration.

### Running integration tests against real Postgres

```bash
docker compose -f docker-compose.test.yml up -d
cp .env.example .env
DB_HOST=localhost DB_PORT=5546 DB_USER=notification_service DB_PASSWORD=notification_service DB_NAME=notification_service npm run test:e2e
```

`test/notifications.e2e-spec.ts` overrides the `PG_POOL` provider with
`pg-mem` (an in-memory, spec-compliant SQL engine) and the
`NOTIFICATION_PROVIDER_ADAPTER` provider with a controllable, no-network
fake, so it runs without a docker daemon and without ever attempting a
real SMS/email send; the production code path (real `pg` Pool against real
Postgres, real Twilio/SendGrid adapters when explicitly enabled) is
unchanged.
