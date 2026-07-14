export interface InternalServiceConfig {
  /**
   * Shared secret presented via the `X-Internal-Service-Key` header
   * (`InternalServiceGuard`) by trusted, service-to-service callers -- today,
   * only `services/tenant`'s `OnboardingService` (BAC-12), calling
   * `POST /notifications/internal` as part of `POST /tenants/onboard`'s
   * orchestration.
   */
  internalServiceKey: string;
}

/** Dev-only placeholder secret; never valid outside test/development. */
const DEV_INSECURE_INTERNAL_SERVICE_KEY =
  'dev-insecure-internal-service-key-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Fail-fast guard mirroring `services/auth`'s `internal-service.config.ts`
 * (kept as its own small copy here, not a shared package -- see that file's
 * doc comment for why this repo duplicates small guard-style logic per
 * service rather than sharing it).
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
 * Reads the internal-service shared secret from the environment. Falls back
 * to a dev-only placeholder so the service still boots for local/test use
 * without a `.env` file; `.env.example` documents that real deployments must
 * override it with the SAME value `services/tenant` is configured to send.
 */
export function getInternalServiceConfig(): InternalServiceConfig {
  const nodeEnv = process.env.NODE_ENV;
  const key = process.env.INTERNAL_SERVICE_KEY;

  assertSecretConfiguredOutsideDevTest(
    'INTERNAL_SERVICE_KEY',
    key,
    DEV_INSECURE_INTERNAL_SERVICE_KEY,
    nodeEnv,
  );

  return {
    internalServiceKey: key ?? DEV_INSECURE_INTERNAL_SERVICE_KEY,
  };
}
