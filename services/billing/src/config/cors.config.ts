import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Dev-only fallback allowed origin: mirrors `services/tenant`'s (BAC-12),
 * `services/auth`'s (BAC-13), and `services/patient`'s (BAC-14)
 * `src/config/cors.config.ts` -- added here proactively (this service had no
 * CORS wiring at all until now) rather than waiting for a frontend ticket to
 * hit the same missing-CORS bug a fourth time. `apps/web`'s dev server is
 * pinned to port 3000 (`apps/web/package.json`'s `dev` script), while every
 * backend service claims a fixed port starting from 3001 (see
 * `scripts/start-all-local.sh`) so it never collides with the frontend.
 * Real deployments MUST override via `CORS_ALLOWED_ORIGINS` (comma-separated).
 */
const DEV_DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

/** Methods the browser calls on this service: `POST /billing/usage/events` and `GET /billing/usage`. */
const ALLOWED_METHODS = ['GET', 'POST'];

/**
 * Headers the frontend sends. Every route on this service is guarded by
 * `TenantGuard` + `AccessTokenGuard` + `PermissionsGuard`, so both
 * `X-Tenant-Id` and `Authorization` are needed; `Content-Type` for the JSON
 * `POST` body.
 */
const ALLOWED_HEADERS = ['Authorization', 'X-Tenant-Id', 'Content-Type'];

/**
 * Builds this service's CORS policy, same shape as `services/tenant`'s
 * BAC-12, `services/auth`'s BAC-13, and `services/patient`'s BAC-14
 * `getCorsConfig()`: `services/billing` is called cross-origin by `apps/web`
 * in every real deployment (they're separate deployables), so without this,
 * every browser request -- including the preflight `OPTIONS` -- is blocked
 * by the browser before it ever reaches a route handler. `CORS_ALLOWED_ORIGINS`
 * (comma-separated) lets a real deployment configure its actual frontend
 * origin(s); unset falls back to a small set of common local dev origins.
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
