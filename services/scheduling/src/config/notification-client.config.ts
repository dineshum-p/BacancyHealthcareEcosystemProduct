export interface NotificationClientConfig {
  /** Base URL `services/scheduling` calls into `services/notification` on (BAC-16). */
  notificationServiceUrl: string;
  /**
   * Shared secret sent as `X-Internal-Service-Key` -- MUST equal the value
   * `services/notification` is configured with (its own
   * `internal-service.config.ts`/`InternalServiceGuard`).
   */
  internalServiceKey: string;
  /** Bound, in milliseconds, on a SINGLE outbound HTTP call to `services/notification`. */
  requestTimeoutMs: number;
}

const DEFAULT_NOTIFICATION_SERVICE_URL = 'http://localhost:3004';
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

/** Dev-only placeholder secret; never valid outside test/development. */
const DEV_INSECURE_INTERNAL_SERVICE_KEY =
  'dev-insecure-internal-service-key-change-me';

/** `NODE_ENV` values that are allowed to fall back to the dev placeholder. */
const ENVS_ALLOWING_INSECURE_DEFAULT = new Set(['test', 'development']);

/**
 * Fail-fast guard mirroring `services/tenant`'s BAC-12 `onboarding.config.ts`
 * (kept as its own small copy here -- see that file's doc comment for why
 * this repo duplicates small guard-style logic per service rather than
 * sharing it).
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
 * Reads BAC-16's `services/notification` integration settings from the
 * environment. `notificationServiceUrl` is a plain (non-secret) default
 * pointing at that sibling service's default local port (see
 * `scripts/start-all-local.sh`); `internalServiceKey` follows the same
 * fail-fast-outside-dev/test pattern as every other secret in this repo.
 */
export function getNotificationClientConfig(): NotificationClientConfig {
  const nodeEnv = process.env.NODE_ENV;
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  assertSecretConfiguredOutsideDevTest(
    'INTERNAL_SERVICE_KEY',
    internalServiceKey,
    DEV_INSECURE_INTERNAL_SERVICE_KEY,
    nodeEnv,
  );

  return {
    notificationServiceUrl:
      process.env.NOTIFICATION_SERVICE_URL ?? DEFAULT_NOTIFICATION_SERVICE_URL,
    internalServiceKey: internalServiceKey ?? DEV_INSECURE_INTERNAL_SERVICE_KEY,
    requestTimeoutMs: Number(
      process.env.NOTIFICATION_REQUEST_TIMEOUT_MS ?? DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  };
}
