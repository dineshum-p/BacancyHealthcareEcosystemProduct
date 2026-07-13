export interface OnboardingConfig {
  /** Base URL `services/tenant` calls into `services/auth` on (BAC-12, `POST /auth/admin-seed`). */
  authServiceUrl: string;
  /** Base URL `services/tenant` calls into `services/notification` on (BAC-12, `POST /notifications/internal`). */
  notificationServiceUrl: string;
  /**
   * Shared secret sent as `X-Internal-Service-Key` to both downstream
   * services -- MUST equal the value each of `services/auth` and
   * `services/notification` is configured with (their own
   * `internal-service.config.ts`/`InternalServiceGuard`).
   */
  internalServiceKey: string;
  /** Bound, in milliseconds, on a SINGLE outbound orchestration HTTP call (see `HttpAuthServiceClient`/`HttpNotificationServiceClient`). */
  requestTimeoutMs: number;
}

const DEFAULT_AUTH_SERVICE_URL = 'http://localhost:3001';
const DEFAULT_NOTIFICATION_SERVICE_URL = 'http://localhost:3003';
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

/** Dev-only placeholder secret; never valid outside test/development. */
const DEV_INSECURE_INTERNAL_SERVICE_KEY =
  'dev-insecure-internal-service-key-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Fail-fast guard mirroring `services/auth`/`services/notification`'s own
 * `internal-service.config.ts` (kept as its own small copy here -- see
 * either of those files' doc comment for why this repo duplicates small
 * guard-style logic per service rather than sharing it).
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
 * Reads BAC-12's onboarding-orchestration settings from the environment.
 * `authServiceUrl`/`notificationServiceUrl` are plain (non-secret) defaults
 * pointing at each sibling service's default local port; `internalServiceKey`
 * follows the same fail-fast-outside-dev/test pattern as every other secret
 * in this repo (`getAuthConfig`, `getInternalServiceConfig`).
 */
export function getOnboardingConfig(): OnboardingConfig {
  const nodeEnv = process.env.NODE_ENV;
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  assertSecretConfiguredOutsideDevTest(
    'INTERNAL_SERVICE_KEY',
    internalServiceKey,
    DEV_INSECURE_INTERNAL_SERVICE_KEY,
    nodeEnv,
  );

  return {
    authServiceUrl: process.env.AUTH_SERVICE_URL ?? DEFAULT_AUTH_SERVICE_URL,
    notificationServiceUrl:
      process.env.NOTIFICATION_SERVICE_URL ?? DEFAULT_NOTIFICATION_SERVICE_URL,
    internalServiceKey: internalServiceKey ?? DEV_INSECURE_INTERNAL_SERVICE_KEY,
    requestTimeoutMs: Number(
      process.env.ONBOARDING_REQUEST_TIMEOUT_MS ?? DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  };
}
