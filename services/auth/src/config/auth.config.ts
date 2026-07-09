export interface AuthConfig {
  /** Secret used to sign/verify access-token JWTs. */
  jwtAccessSecret: string;
  /** Access token lifetime, in seconds (AC2: short-lived; default 15 min). */
  accessTokenTtlSeconds: number;
  /** Refresh token lifetime, in seconds (AC4; default 7 days). */
  refreshTokenTtlSeconds: number;
}

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Reads JWT signing/expiry settings from the environment. The access-token
 * secret falls back to a dev-only placeholder (mirrors `getDatabaseConfig`'s
 * defaulting pattern) so the service still boots for local/test use without
 * a `.env` file; `.env.example` documents that real deployments must
 * override it.
 */
export function getAuthConfig(): AuthConfig {
  return {
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'dev-insecure-access-secret-change-me',
    accessTokenTtlSeconds: Number(
      process.env.ACCESS_TOKEN_TTL_SECONDS ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshTokenTtlSeconds: Number(
      process.env.REFRESH_TOKEN_TTL_SECONDS ??
        DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    ),
  };
}
