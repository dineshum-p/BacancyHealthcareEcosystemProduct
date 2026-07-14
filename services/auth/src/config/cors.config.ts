import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Dev-only fallback allowed origins (BAC-13 bug fix, mirrors `services/tenant`'s
 * `src/config/cors.config.ts` from BAC-12): `apps/web`'s own dev server
 * defaults to port 3000, but that's also this service's own default port
 * (`main.ts`, `PORT ?? 3001`), so in practice a locally-run frontend ends up
 * on the next free port (commonly 3001-3002) instead. Rather than hard-code
 * one guess, allow this small, well-known set of local dev origins out of the
 * box; real deployments MUST override via `CORS_ALLOWED_ORIGINS`
 * (comma-separated) same as every other env-driven config in this service.
 */
const DEV_DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

/**
 * Methods the browser calls on this service. `apps/web`'s `authApi.ts` only
 * calls `POST /auth/login` and `POST /auth/mfa/login-verify` cross-origin
 * today (BAC-13), but `AuthController` also exposes `GET /auth/roles` and
 * `PATCH /auth/users/:id/role` behind `AccessTokenGuard` -- both plausible
 * future cross-origin browser calls -- so they're included now rather than
 * requiring a second CORS bug report per method.
 */
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH'];

/**
 * Headers the frontend sends or may need to send. `authApi.ts`'s
 * `buildTenantHeaders` sends `Content-Type` and `X-Tenant-Id` on the two
 * unauthenticated routes it calls (`login`, `mfa/login-verify`) -- neither
 * needs `Authorization` (see that function's doc comment for why). Every
 * OTHER route on this controller (`mfa/enroll`, `mfa/verify`, `roles`,
 * `users/:id/role`) is guarded by `AccessTokenGuard` and DOES need a bearer
 * token, so `Authorization` is included here too: cheap to allow now,
 * avoids a third CORS bug report the moment a browser caller needs it.
 */
const ALLOWED_HEADERS = ['Authorization', 'X-Tenant-Id', 'Content-Type'];

/**
 * Builds this service's CORS policy (BAC-13 bug fix, same shape as
 * `services/tenant`'s `getCorsConfig()` from BAC-12): `services/auth` is
 * called cross-origin by `apps/web` in every real deployment (they're
 * separate deployables), so without this, every browser request --
 * including the preflight `OPTIONS` -- is blocked by the browser before it
 * ever reaches a route handler. `CORS_ALLOWED_ORIGINS` (comma-separated)
 * lets a real deployment configure its actual frontend origin(s); unset
 * falls back to a small set of common local dev origins so the login/MFA
 * console works out of the box.
 */
export function getCorsConfig(): CorsOptions {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const origin = configuredOrigins
    ? configuredOrigins.split(',').map((value) => value.trim())
    : DEV_DEFAULT_ALLOWED_ORIGINS;

  return {
    origin,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: true,
  };
}
