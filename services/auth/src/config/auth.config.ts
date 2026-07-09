export interface AuthConfig {
  /** Secret used to sign/verify access-token JWTs. */
  jwtAccessSecret: string;
  /** Access token lifetime, in seconds (AC2: short-lived; default 15 min). */
  accessTokenTtlSeconds: number;
  /** Refresh token lifetime, in seconds (AC4; default 7 days). */
  refreshTokenTtlSeconds: number;
  /**
   * Key used to derive the AES-256-GCM key that encrypts/decrypts TOTP
   * secrets at rest (BAC-6). Unlike `jwtAccessSecret` this value backs
   * REVERSIBLE encryption, not a signature -- see
   * `src/auth/totp-secret-cipher.util.ts`.
   */
  mfaEncryptionKey: string;
}

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Dev-only placeholder secret; never valid outside test/development. */
const DEV_INSECURE_ACCESS_SECRET = 'dev-insecure-access-secret-change-me';

/**
 * Dev-only placeholder MFA encryption key; never valid outside
 * test/development. Distinct from `DEV_INSECURE_ACCESS_SECRET` so the two
 * checks below never accidentally cross-accept each other's placeholder.
 */
const DEV_INSECURE_MFA_ENCRYPTION_KEY = 'dev-insecure-mfa-key-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Shared fail-fast guard behind both `JWT_ACCESS_SECRET` and
 * `MFA_ENCRYPTION_KEY`: refuses to let an unset/blank/known-placeholder
 * secret stand in for a real one outside `test`/`development` (i.e.
 * anything that could be a real deployment, including an unset `NODE_ENV`).
 * Both placeholders are committed in `.env.example` and public in this
 * repo's history, so letting either stand in for a real secret in
 * production would let anyone forge access-token JWTs / decrypt every
 * tenant's TOTP secrets.
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
 * Reads JWT signing/expiry settings and the MFA secret-encryption key from
 * the environment. Both secrets fall back to dev-only placeholders (mirrors
 * `getDatabaseConfig`'s defaulting pattern) so the service still boots for
 * local/test use without a `.env` file; `.env.example` documents that real
 * deployments must override them.
 */
export function getAuthConfig(): AuthConfig {
  const nodeEnv = process.env.NODE_ENV;
  const secret = process.env.JWT_ACCESS_SECRET;
  const mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY;

  assertSecretConfiguredOutsideDevTest(
    'JWT_ACCESS_SECRET',
    secret,
    DEV_INSECURE_ACCESS_SECRET,
    nodeEnv,
  );
  assertSecretConfiguredOutsideDevTest(
    'MFA_ENCRYPTION_KEY',
    mfaEncryptionKey,
    DEV_INSECURE_MFA_ENCRYPTION_KEY,
    nodeEnv,
  );

  return {
    jwtAccessSecret: secret ?? DEV_INSECURE_ACCESS_SECRET,
    accessTokenTtlSeconds: Number(
      process.env.ACCESS_TOKEN_TTL_SECONDS ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshTokenTtlSeconds: Number(
      process.env.REFRESH_TOKEN_TTL_SECONDS ??
        DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    ),
    mfaEncryptionKey: mfaEncryptionKey ?? DEV_INSECURE_MFA_ENCRYPTION_KEY,
  };
}
