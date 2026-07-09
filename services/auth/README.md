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
