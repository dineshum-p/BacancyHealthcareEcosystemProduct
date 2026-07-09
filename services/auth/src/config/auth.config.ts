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

/** Dev-only placeholder secret; never valid outside test/development. */
const DEV_INSECURE_ACCESS_SECRET = 'dev-insecure-access-secret-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Reads JWT signing/expiry settings from the environment. The access-token
 * secret falls back to a dev-only placeholder (mirrors `getDatabaseConfig`'s
 * defaulting pattern) so the service still boots for local/test use without
 * a `.env` file; `.env.example` documents that real deployments must
 * override it.
 *
 * Outside `test`/`development` (i.e. anything that could be a real
 * deployment, including an unset `NODE_ENV`), this throws instead of
 * silently booting with the placeholder secret -- that placeholder is
 * committed in `.env.example` and public in this repo's history, so letting
 * it stand in for a real secret would let anyone forge a valid access-token
 * JWT with an arbitrary userId/tenantId/role.
 */
export function getAuthConfig(): AuthConfig {
  const nodeEnv = process.env.NODE_ENV;
  const secret = process.env.JWT_ACCESS_SECRET;
  const isInsecureDefault =
    secret === undefined || secret === DEV_INSECURE_ACCESS_SECRET;

  if (isInsecureDefault && !ENVS_ALLOWING_INSECURE_DEFAULT.has(nodeEnv ?? '')) {
    throw new Error(
      'JWT_ACCESS_SECRET is unset or equals the known dev placeholder ' +
        `("${DEV_INSECURE_ACCESS_SECRET}"). Refusing to start outside ` +
        'test/development (NODE_ENV=' +
        `${nodeEnv ?? '<unset>'}) -- set a strong random JWT_ACCESS_SECRET.`,
    );
  }

  return {
    jwtAccessSecret: secret ?? DEV_INSECURE_ACCESS_SECRET,
    accessTokenTtlSeconds: Number(
      process.env.ACCESS_TOKEN_TTL_SECONDS ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshTokenTtlSeconds: Number(
      process.env.REFRESH_TOKEN_TTL_SECONDS ??
        DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    ),
  };
}
