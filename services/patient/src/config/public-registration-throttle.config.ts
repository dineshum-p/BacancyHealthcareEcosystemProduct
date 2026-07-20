export interface PublicRegistrationThrottleConfig {
  /** Max requests a single tracker (by default, caller IP) may make within `ttlMs`. */
  limit: number;
  ttlMs: number;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_TTL_MS = 60_000;

/**
 * Reads BAC-36's rate-limit config for the PUBLIC, unauthenticated
 * `POST /public/tenants/:tenantSlug/patients` endpoint: with no auth token to
 * gate abuse, this is the only defense against a flood of bogus
 * self-registration submissions. Overridable via environment so integration
 * tests can exercise the 429 behaviour deterministically with a tiny limit
 * without waiting out a real 60-second window or affecting the default
 * (generous) limit every functional test runs against.
 */
export function getPublicRegistrationThrottleConfig(): PublicRegistrationThrottleConfig {
  const limit = Number(
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT ?? DEFAULT_LIMIT,
  );
  const ttlMs = Number(
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_TTL_MS ?? DEFAULT_TTL_MS,
  );
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    ttlMs: Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS,
  };
}
