import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Dev-only fallback allowed origins (BAC-14, added proactively -- mirrors
 * `services/tenant`'s (BAC-12) and `services/auth`'s (BAC-13) identical
 * `src/config/cors.config.ts`, both of which had to add this REACTIVELY
 * after a missing-CORS bug was found once a frontend ticket actually called
 * them cross-origin. BAC-17 ("Register and search patients from the clinic
 * UI") will call THIS service directly from the browser, so this is added
 * now instead of waiting for that bug report): `apps/web`'s dev server
 * defaults to port 3000, but a locally-run frontend commonly ends up on the
 * next free port (3001-3002) instead when other services are also running
 * locally. Real deployments MUST override via `CORS_ALLOWED_ORIGINS`
 * (comma-separated).
 */
const DEV_DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

/** Methods the browser calls on this service: `POST /patients` (register) and `GET /patients` (search). */
const ALLOWED_METHODS = ['GET', 'POST'];

/**
 * Headers the frontend sends. Every route on this service is guarded by
 * `TenantGuard` + `AccessTokenGuard`, so both `X-Tenant-Id` and
 * `Authorization` are needed; `Content-Type` for the JSON `POST /patients`
 * body.
 */
const ALLOWED_HEADERS = ['Authorization', 'X-Tenant-Id', 'Content-Type'];

/**
 * Builds this service's CORS policy (BAC-14, same shape as
 * `services/tenant`'s BAC-12 and `services/auth`'s BAC-13
 * `getCorsConfig()`): `services/patient` is called cross-origin by
 * `apps/web` in every real deployment (they're separate deployables), so
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
