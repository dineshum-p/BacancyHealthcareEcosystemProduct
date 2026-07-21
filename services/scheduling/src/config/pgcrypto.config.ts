export interface PgcryptoConfig {
  /**
   * Symmetric key `VisitIntakesRepository` passes to Postgres's `pgcrypto`
   * extension (`pgp_sym_encrypt`/`pgp_sym_decrypt`, BAC-45) to encrypt/
   * decrypt the `reason_for_visit`/`symptoms`/`whats_new_since_last_visit`
   * columns. Sourced from config/env -- NEVER hardcoded -- exactly like
   * `services/emr`'s BAC-44 `PgcryptoConfig` this mirrors (that service's
   * doc comment explains why the same treatment applies here: an
   * independently deployable service cannot import that config, so it is
   * replicated, not shared).
   */
  columnEncryptionKey: string;
}

/** Dev-only placeholder key; never valid outside test/development. */
const DEV_INSECURE_COLUMN_ENCRYPTION_KEY =
  'dev-insecure-column-encryption-key-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Fail-fast guard, deliberately identical in shape to `auth.config.ts`'s own
 * `assertSecretConfiguredOutsideDevTest` (see that file's doc comment for why
 * this class of bug -- an insecure default silently accepted in production --
 * has already been found and fixed twice in this project, BAC-5/BAC-6): a
 * PHI column-encryption key is at least as sensitive as a JWT secret, so it
 * gets the exact same "refuse to boot outside test/development with an
 * unset/blank/known-placeholder value" treatment.
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
 * Reads BAC-45's PHI column-encryption key from the environment, mirroring
 * `services/emr`'s BAC-44 `getPgcryptoConfig` exactly. Falls back to a
 * dev-only placeholder so the service still boots for local/test use without
 * a `.env` file; `.env.example` documents that real deployments MUST
 * override it with a strong random value, and that rotating it makes every
 * previously-encrypted `reason_for_visit`/`symptoms`/
 * `whats_new_since_last_visit` value undecryptable (there is no
 * key-rotation/re-encryption tooling in this ticket's scope).
 */
export function getPgcryptoConfig(): PgcryptoConfig {
  const nodeEnv = process.env.NODE_ENV;
  const key = process.env.PGCRYPTO_COLUMN_KEY;

  assertSecretConfiguredOutsideDevTest(
    'PGCRYPTO_COLUMN_KEY',
    key,
    DEV_INSECURE_COLUMN_ENCRYPTION_KEY,
    nodeEnv,
  );

  return {
    columnEncryptionKey: key ?? DEV_INSECURE_COLUMN_ENCRYPTION_KEY,
  };
}
