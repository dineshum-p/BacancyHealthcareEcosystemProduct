import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Dev-only fallback allowed origins (BAC-12 bug fix): `apps/web`'s own dev
 * server defaults to port 3000, but that's also `services/tenant`'s own
 * default port (`main.ts`, `PORT ?? 3000`), so in practice a locally-run
 * frontend ends up on the next free port (commonly 3001-3002) instead. Rather
 * than hard-code one guess, allow this small, well-known set of local dev
 * origins out of the box; real deployments MUST override via
 * `CORS_ALLOWED_ORIGINS` (comma-separated) same as every other env-driven
 * config in this service.
 */
const DEV_DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

/** Methods the tenant onboarding console actually calls (BAC-12: `GET /tenants`, `POST /tenants/onboard`). */
const ALLOWED_METHODS = ['GET', 'POST'];

/**
 * Headers the frontend sends on every request (`apps/web/src/lib/api/tenantsApi.ts`'s
 * `buildAuthHeaders`): a bearer access token, the caller's tenant id, and
 * `Content-Type` on the JSON `POST`.
 */
const ALLOWED_HEADERS = ['Authorization', 'X-Tenant-Id', 'Content-Type'];

/**
 * Builds this service's CORS policy (BAC-12 bug fix): `services/tenant` is
 * called cross-origin by `apps/web` in every real deployment (they're
 * separate deployables), so without this, every browser request -- including
 * the preflight `OPTIONS` -- is blocked by the browser before it ever reaches
 * a route handler. `CORS_ALLOWED_ORIGINS` (comma-separated) lets a real
 * deployment configure its actual frontend origin(s); unset falls back to a
 * small set of common local dev origins so the console works out of the box.
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
