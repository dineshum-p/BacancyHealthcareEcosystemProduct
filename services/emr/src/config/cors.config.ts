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

/**
 * Methods the browser calls on this service: `POST /fhir/Patient`,
 * `GET /fhir/Patient/:id`, `POST /patients/:patientId/encounters`, and
 * `GET /patients/:patientId/encounters`.
 */
const ALLOWED_METHODS = ['GET', 'POST'];

/**
 * Headers the frontend sends. Every route on this service is guarded by
 * `TenantGuard` + `AccessTokenGuard` (+ `PermissionsGuard`), so both
 * `X-Tenant-Id` and `Authorization` are needed; `Content-Type` for the JSON
 * `POST` bodies.
 */
const ALLOWED_HEADERS = ['Authorization', 'X-Tenant-Id', 'Content-Type'];

/**
 * Root-domain suffix for subdomain-per-tenant deployments (BAC-38):
 * `apps/web`'s middleware resolves a tenant from ITS OWN subdomain (e.g.
 * `acme-clinic.yourapp.com`), so this service must accept that as a CORS
 * origin too, not just one fixed frontend origin. Matching is done on the
 * parsed `URL#hostname`, never a raw string suffix check, so
 * `evil-yourapp.com` cannot spoof `yourapp.com`.
 */
export function isAllowedOrigin(
  origin: string,
  exactOrigins: string[],
  rootDomain: string | undefined,
): boolean {
  if (exactOrigins.includes(origin)) {
    return true;
  }
  if (!rootDomain) {
    return false;
  }
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
}

/**
 * Builds this service's CORS policy, same shape as `services/tenant`'s
 * BAC-12, `services/auth`'s BAC-13, and `services/patient`'s BAC-14
 * `getCorsConfig()`: `services/emr` is called cross-origin by `apps/web` in
 * every real deployment (they're separate deployables), so without this,
 * every browser request -- including the preflight `OPTIONS` -- is blocked
 * by the browser before it ever reaches a route handler. `CORS_ALLOWED_ORIGINS`
 * (comma-separated) lets a real deployment configure its actual frontend
 * origin(s); unset falls back to a small set of common local dev origins.
 *
 * `CORS_ALLOWED_ORIGIN_SUFFIX` (BAC-38, optional, additive) lets a
 * subdomain-per-tenant deployment allow EVERY tenant subdomain at once
 * instead of enumerating each one in `CORS_ALLOWED_ORIGINS` by hand. Unset
 * keeps today's exact `origin` array behavior; set switches `origin` to a
 * validator function so both the exact list AND any subdomain of the
 * configured root are allowed.
 */
export function getCorsConfig(): CorsOptions {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const exactOrigins = configuredOrigins
    ? configuredOrigins.split(',').map((value) => value.trim())
    : DEV_DEFAULT_ALLOWED_ORIGINS;
  const rootDomain =
    process.env.CORS_ALLOWED_ORIGIN_SUFFIX?.trim() || undefined;

  return {
    origin: rootDomain
      ? (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          if (!origin || isAllowedOrigin(origin, exactOrigins, rootDomain)) {
            callback(null, true);
            return;
          }
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      : exactOrigins,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: true,
  };
}
