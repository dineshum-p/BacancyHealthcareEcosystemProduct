export interface NotificationConfig {
  /** Total attempts (including the first) before a notification is marked `failed`. */
  maxAttempts: number;
  /**
   * Base delay, in milliseconds, for exponential backoff between retries:
   * attempt N (1-indexed) waits `backoffBaseMs * 2^(N-1)` before the NEXT
   * attempt.
   */
  backoffBaseMs: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_BASE_MS = 200;

/**
 * Reads AC3's retry/backoff knobs from the environment, falling back to
 * sane defaults. Both are deliberately configurable (per this ticket's
 * instructions) rather than hard-coded, since the right values depend on
 * the real vendor's own rate limits/latency once `NOTIFICATION_PROVIDER_MODE
 * =real` is ever used.
 */
export function getNotificationConfig(): NotificationConfig {
  const maxAttempts = Number(
    process.env.NOTIFICATION_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS,
  );
  const backoffBaseMs = Number(
    process.env.NOTIFICATION_BACKOFF_BASE_MS ?? DEFAULT_BACKOFF_BASE_MS,
  );

  return {
    maxAttempts:
      Number.isFinite(maxAttempts) && maxAttempts > 0
        ? Math.floor(maxAttempts)
        : DEFAULT_MAX_ATTEMPTS,
    backoffBaseMs:
      Number.isFinite(backoffBaseMs) && backoffBaseMs >= 0
        ? backoffBaseMs
        : DEFAULT_BACKOFF_BASE_MS,
  };
}
