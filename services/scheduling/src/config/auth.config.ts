export interface AuthConfig {
  /** Secret used to verify access-token JWTs issued by `services/auth`. */
  jwtAccessSecret: string;
}

/** Dev-only placeholder secret; never valid outside test/development. */
const DEV_INSECURE_ACCESS_SECRET = 'dev-insecure-access-secret-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Fail-fast guard mirroring `services/tenant`/`services/auth`/
 * `services/notification`/`services/emr`/`services/billing`/
 * `services/patient`'s `auth.config.ts`: refuses to let an unset/blank/
 * known-placeholder secret stand in for a real one outside `test`/
 * `development` (i.e. anything that could be a real deployment, including an
 * unset `NODE_ENV`). This exact class of config vulnerability (an insecure
 * default silently accepted in production) was found and fixed twice already
 * in this project (BAC-5, BAC-6) -- every new service that verifies JWTs
 * must not reintroduce it.
 *
 * `services/scheduling` never SIGNS tokens (only `services/auth` does), but
 * it must use the exact same secret to verify them, so the placeholder here
 * is intentionally identical to the other services' -- all must be
 * configured with the same real `JWT_ACCESS_SECRET` in any real deployment.
 */
function assertSecretConfiguredOutsideDevTest(
  envVarName: string,
  value: string | undefined,
  insecureDefault: string,
  nodeEnv: string | undefined,
): void {
  const isInsecureDefault =
    value === undefined || value.trim() === '' || value === insecureDefault;

  if (isInsecureDefault && !ENVS_ALLOWING_INSECURE_DEFAULT.has(nodeEnv ?? '')) {
    throw new Error(
      `${envVarName} is unset or equals the known dev placeholder ` +
        `("${insecureDefault}"). Refusing to start outside ` +
        'test/development (NODE_ENV=' +
        `${nodeEnv ?? '<unset>'}) -- set a strong random ${envVarName}.`,
    );
  }
}

/**
 * Reads the JWT verification secret from the environment. Falls back to a
 * dev-only placeholder (mirrors `getDatabaseConfig`'s defaulting pattern) so
 * the service still boots for local/test use without a `.env` file;
 * `.env.example` documents that real deployments must override it with the
 * SAME value `services/auth` signs tokens with.
 */
export function getAuthConfig(): AuthConfig {
  const nodeEnv = process.env.NODE_ENV;
  const secret = process.env.JWT_ACCESS_SECRET;

  assertSecretConfiguredOutsideDevTest(
    'JWT_ACCESS_SECRET',
    secret,
    DEV_INSECURE_ACCESS_SECRET,
    nodeEnv,
  );

  return {
    jwtAccessSecret: secret ?? DEV_INSECURE_ACCESS_SECRET,
  };
}
