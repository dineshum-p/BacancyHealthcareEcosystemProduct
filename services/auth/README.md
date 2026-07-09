<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Auth: register, login, refresh (BAC-5)

This service issues JWT access tokens + revocable refresh tokens, scoped to
a tenant resolved the same conceptual way `services/tenant`'s BAC-4 guard
does -- but as an independently deployable NestJS app, it does not import
TypeScript from `services/tenant`; it only shares the same underlying
Postgres cluster/`public.tenants` registry, read-only, at the SQL level.

### Endpoints

- `POST /auth/register` -- creates a user scoped to the resolved tenant with
  an Argon2-hashed password. Returns `201` with `{ id, email, role, createdAt }`
  (never the password hash).
- `POST /auth/login` -- verifies credentials and returns
  `{ accessToken, refreshToken, expiresIn }`. Invalid credentials (unknown
  email OR wrong password) return a uniform `401` with an identical message,
  and the login path always performs a real Argon2 verify (against a cached
  dummy hash when the user doesn't exist) so a nonexistent-user login isn't
  an obvious timing oracle.
- `POST /auth/refresh` -- exchanges a valid, unrevoked, unexpired refresh
  token for a new `{ accessToken, expiresIn }`. An unknown, revoked, or
  expired refresh token returns `401`.

All three endpoints require an `X-Tenant-Id` header (resolved against
`public.tenants`, read-only from this service). Unlike BAC-4's tenant-facing
404 (unknown) / 403 (inactive) split, **this service returns a uniform `401`
for both** -- auth endpoints are unauthenticated by definition, so a
different status code per failure reason would let a caller enumerate
tenants, and 401 is consistent with the login endpoint's own uniform-error
requirement.

### Tenant resolution & schema binding

- `TenantGuard` (`src/tenant-context/tenant.guard.ts`) resolves the
  `X-Tenant-Id` header (no subdomain fallback -- out of scope for this
  ticket) against `public.tenants` and rejects unknown/inactive tenants
  before any handler runs.
- `TenantContextService` (`src/tenant-context/tenant-context.service.ts`) is
  a request-scoped provider that binds a Postgres client to the resolved
  tenant's schema via `SET search_path` for the rest of the request.
  Repositories additionally fully-qualify `schema.table` in every query
  (`quoteSchemaIdentifier`) rather than relying on `search_path` alone --
  it's a documented no-op in `pg-mem`, used by this service's own tests.
- `src/tenants/schema-identifier.util.ts` is the single choke point that
  validates a schema name against an allow-list before it is ever
  interpolated into SQL.
- `AuthSchemaProvisioner` (`src/auth/auth-schema.provisioner.ts`) lazily
  creates this service's own `users` / `refresh_tokens` tables inside a
  tenant's *already-existing* schema the first time a request needs them.
  It never creates the schema itself -- provisioning tenants is
  `services/tenant`'s job (BAC-3) -- which keeps the two services
  decoupled: `services/auth` doesn't need to be told when a new tenant is
  onboarded.

### Password hashing & refresh-token revocation

- Passwords are hashed with `argon2` (argon2id, the library default),
  the OWASP-recommended choice. Hashes are never logged or returned.
- Refresh tokens are opaque, high-entropy random values (32 bytes,
  hex-encoded) -- **not** JWTs. They are persisted as a SHA-256 hash (never
  the raw value) plus `expires_at` and a `revoked` flag in each tenant's
  `refresh_tokens` table, so they can be invalidated server-side (a pure
  stateless JWT refresh token can never be revoked before its own expiry).
  `RefreshTokensRepository.revoke()` implements this and is covered by unit
  tests; no public logout endpoint is wired to it in this ticket since no
  acceptance criterion specifies one.

### JWT claims

Access tokens are signed with `@nestjs/jwt` and carry exactly:

```json
{ "userId": "...", "tenantId": "...", "role": "member" }
```

`AccessTokenPayload`, `AuthTokens`, `AccessTokenResponse`, `RegisteredUser`
and `UserRole` are exported from `@hep/shared-types` so the frontend can
type-check anything it decodes/receives without redefining the contract.

Configurable via env (`.env.example`): `JWT_ACCESS_SECRET`,
`ACCESS_TOKEN_TTL_SECONDS` (default 900 = 15 min),
`REFRESH_TOKEN_TTL_SECONDS` (default 604800 = 7 days).

## MFA: TOTP enrollment, activation, and login enforcement (BAC-6)

### Endpoints

- `POST /auth/mfa/enroll` -- requires `Authorization: Bearer <access-token>`
  (see `AccessTokenGuard` below). Generates a fresh TOTP secret, stores it
  encrypted, sets the user's MFA status to `pending`, and returns
  `{ secret, otpauthUrl }` for a QR code / manual-entry key. Calling it again
  before verifying simply restarts enrollment with a new secret.
- `POST /auth/mfa/verify` -- also requires a Bearer access token. Body:
  `{ totpCode }`. On a valid code against the pending secret: activates MFA
  (`pending` -> `active`) and returns `{ recoveryCodes: string[] }` -- the
  raw codes are returned **exactly once**, in this response; only their
  SHA-256 hashes are persisted and they can never be redisplayed. An invalid
  code returns `401`; calling this with no pending enrollment (status `none`
  or already `active`) returns `409` (a state conflict, not a bad code).
- `POST /auth/login` -- unchanged wire shape when MFA is `none`/`pending`.
  When the account's MFA is `active`, valid credentials now return
  `{ mfaRequired: true, mfaChallengeToken }` instead of tokens.
- `POST /auth/mfa/login-verify` -- body: `{ mfaChallengeToken, totpCode }`.
  Exchanges a valid, unexpired, correctly-scoped challenge token plus a
  valid, unused TOTP code for real `{ accessToken, refreshToken, expiresIn }`.
  An invalid/expired/wrong-tenant challenge token, an invalid code, or a
  *reused* code all collapse to the same uniform `401` -- no tokens issued.

### MFA status lifecycle

`mfaStatus` on each tenant's `users` row is `none` (default) ->
`pending` (`enroll` generated a secret, not yet confirmed) -> `active`
(`verify` confirmed a code; every subsequent login is challenged). Enrolling
again while `pending` restarts enrollment; there is no path back to `none`
or `pending` from `active` in this ticket (no disable-MFA endpoint --
deliberate scope call, same as BAC-5 skipped a logout endpoint).

### TOTP secret storage: reversible encryption, not hashing

Unlike passwords (Argon2) and refresh tokens (SHA-256), a TOTP secret must
be **decryptable** -- the server needs the raw secret at verify time to
compute the expected 6-digit code. `totp-secret-cipher.util.ts` encrypts it
with AES-256-GCM, keyed by `MFA_ENCRYPTION_KEY` (SHA-256-derived into a
32-byte key, the same "accept any string" convenience `JWT_ACCESS_SECRET`
gets from HMAC). `getAuthConfig()` applies the exact fail-fast pattern BAC-5
established for `JWT_ACCESS_SECRET`: refuses to boot outside
`test`/`development` if `MFA_ENCRYPTION_KEY` is unset, blank, or the known
placeholder. The raw secret and its decrypted form are never logged.

### TOTP generation/verification

`totp.util.ts` wraps `otplib`'s `authenticator` and deliberately relies on
its defaults -- 30s step, 6 digits, HMAC-SHA1 -- rather than overriding
them, since real authenticator apps (Google Authenticator, Authy, etc.)
assume exactly those values.

### Replay prevention (AC4)

Each user row tracks `mfa_last_used_step` -- the TOTP time-step index
(`floor(unixTime / 30)`) last successfully consumed, not the raw code
string (a 6-digit code can legitimately recur across non-adjacent steps).
`UsersRepository.recordMfaStepIfNewer` / `activateMfa` update this
atomically in a single `UPDATE ... WHERE mfa_last_used_step IS NULL OR
mfa_last_used_step < $step`, so of two concurrent requests presenting the
same code, only the first to commit can ever advance the floor -- the
second always updates zero rows and is rejected, with no separate
read-then-write race window.

### Recovery codes

`recovery-code.util.ts` generates 10 opaque, high-entropy codes (128 bits
each, uppercase hex, formatted as 4 groups of 8:
`XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`) per activation. Only their Argon2
(argon2id) hashes are persisted (`mfa_recovery_codes`, write-only from this
ticket's perspective) -- the same slow, per-call-salted hash used for
passwords (`password-hasher.util.ts`), so a leaked `mfa_recovery_codes` table
isn't quickly brute-forceable offline. **No redemption endpoint exists** --
this ticket's ACs don't specify a recovery-code login flow, so it's a
deliberate scope call (mirrors BAC-5's decision to skip a logout endpoint)
rather than an oversight.

### Login-challenge design (AC3)

`POST /auth/login` returns `{ mfaRequired: true, mfaChallengeToken }`
instead of tokens when MFA is active. `mfaChallengeToken` is issued by
`MfaChallengeTokenService`, a **separate** signing service from
`AccessTokenService` -- not `AccessTokenService` reused unchanged -- with
two independent safeguards against it ever being usable as a Bearer access
token:

1. A distinct `purpose: 'mfa-challenge'` claim, checked explicitly on verify.
2. A cryptographically distinct signing secret, deterministically derived
   from `JWT_ACCESS_SECRET` (`sha256(JWT_ACCESS_SECRET + ':mfa-challenge')`)
   -- no separate env var/fail-fast plumbing needed, while still being
   "a different key": an access token's signature simply does not validate
   against this derived secret, and vice versa, before any claim is even
   inspected.

`POST /auth/mfa/login-verify` is a separate endpoint from `POST
/auth/mfa/verify` (rather than folding enrollment-completion and
login-completion into one route): the two need fundamentally different
authentication -- a Bearer access token identifying an already-logged-in
user vs. a short-lived challenge token identifying a mid-login user with no
access token yet -- and overloading one endpoint with two guard/body shapes
was judged less clear than two thin, single-purpose handlers.

### AccessTokenGuard

`AccessTokenGuard` (`src/auth/access-token.guard.ts`) protects
`mfa/enroll` and `mfa/verify`: a caller must already hold a valid access
token (from a normal login) to start/complete MFA enrollment for their own
account. It must run after `TenantGuard` (Nest always runs class-level
guards before route-level ones) and additionally checks the token's
`tenantId` claim against the already-resolved tenant, rejecting an
otherwise-valid token issued for a different tenant than the current
`X-Tenant-Id`.

Configurable via env (`.env.example`): `MFA_ENCRYPTION_KEY`.

### Running integration tests against real Postgres

```bash
docker compose -f docker-compose.test.yml up -d
cp .env.example .env
DB_HOST=localhost DB_PORT=5545 DB_USER=auth_service DB_PASSWORD=auth_service DB_NAME=auth_service npm run test:e2e
```

`test/auth.e2e-spec.ts` overrides the `PG_POOL` provider with an in-memory,
spec-compliant SQL engine (`pg-mem`) so it can run without a docker daemon;
the production code path (real `pg` Pool against real Postgres) is
unchanged. See `migrations/README.md` for why this service has no static
migrations of its own.
