import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Dev-only fallback allowed origin, mirroring `services/patient`'s (BAC-14),
 * `services/tenant`'s (BAC-12), and `services/auth`'s (BAC-13) identical
 * `src/config/cors.config.ts`: `apps/web`'s dev server is pinned to port 3000
 * (`apps/web/package.json`'s `dev` script), while every backend service
 * claims a fixed port starting from 3001 (see `scripts/start-all-local.sh`)
 * so it never collides with the frontend. Real deployments MUST override via
 * `CORS_ALLOWED_ORIGINS` (comma-separated).
 */
const DEV_DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

/** Methods the browser calls on this service: booking/listing/updating appointments. */
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH'];

/**
 * Headers the frontend sends. Every route on this service is guarded by
 * `TenantGuard` + `AccessTokenGuard`, so both `X-Tenant-Id` and
 * `Authorization` are needed; `Content-Type` for the JSON request bodies.
 */
const ALLOWED_HEADERS = ['Authorization', 'X-Tenant-Id', 'Content-Type'];

/**
 * Builds this service's CORS policy (BAC-16, same shape as every other
 * service's `getCorsConfig()`): `services/scheduling` is called cross-origin
 * by `apps/web` in every real deployment (they're separate deployables), so
 * without this, every browser request -- including the preflight `OPTIONS`
 * -- is blocked by the browser before it ever reaches a route handler.
 * `CORS_ALLOWED_ORIGINS` (comma-separated) lets a real deployment configure
 * its actual frontend origin(s); unset falls back to a small set of common
 * local dev origins so the clinic UI works out of the box.
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
