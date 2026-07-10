import { getNotificationConfig } from './notification.config';

describe('getNotificationConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to 3 max attempts, a 200ms backoff base, and an 8000ms attempt timeout when unset', () => {
    delete process.env.NOTIFICATION_MAX_ATTEMPTS;
    delete process.env.NOTIFICATION_BACKOFF_BASE_MS;
    delete process.env.NOTIFICATION_ATTEMPT_TIMEOUT_MS;

    expect(getNotificationConfig()).toEqual({
      maxAttempts: 3,
      backoffBaseMs: 200,
      attemptTimeoutMs: 8000,
    });
  });

  it('reads overrides from the environment', () => {
    process.env.NOTIFICATION_MAX_ATTEMPTS = '5';
    process.env.NOTIFICATION_BACKOFF_BASE_MS = '50';
    process.env.NOTIFICATION_ATTEMPT_TIMEOUT_MS = '1500';

    expect(getNotificationConfig()).toEqual({
      maxAttempts: 5,
      backoffBaseMs: 50,
      attemptTimeoutMs: 1500,
    });
  });

  it('falls back to the default when maxAttempts is zero, negative, or not a number', () => {
    process.env.NOTIFICATION_MAX_ATTEMPTS = '0';
    expect(getNotificationConfig().maxAttempts).toBe(3);

    process.env.NOTIFICATION_MAX_ATTEMPTS = '-1';
    expect(getNotificationConfig().maxAttempts).toBe(3);

    process.env.NOTIFICATION_MAX_ATTEMPTS = 'not-a-number';
    expect(getNotificationConfig().maxAttempts).toBe(3);
  });

  it('floors a fractional maxAttempts', () => {
    process.env.NOTIFICATION_MAX_ATTEMPTS = '2.9';
    expect(getNotificationConfig().maxAttempts).toBe(2);
  });

  it('falls back to the default when backoffBaseMs is negative or not a number', () => {
    process.env.NOTIFICATION_BACKOFF_BASE_MS = '-5';
    expect(getNotificationConfig().backoffBaseMs).toBe(200);

    process.env.NOTIFICATION_BACKOFF_BASE_MS = 'not-a-number';
    expect(getNotificationConfig().backoffBaseMs).toBe(200);
  });

  it('allows a backoffBaseMs of exactly 0 (no delay between retries)', () => {
    process.env.NOTIFICATION_BACKOFF_BASE_MS = '0';
    expect(getNotificationConfig().backoffBaseMs).toBe(0);
  });

  it('falls back to the default when attemptTimeoutMs is zero, negative, or not a number', () => {
    process.env.NOTIFICATION_ATTEMPT_TIMEOUT_MS = '0';
    expect(getNotificationConfig().attemptTimeoutMs).toBe(8000);

    process.env.NOTIFICATION_ATTEMPT_TIMEOUT_MS = '-100';
    expect(getNotificationConfig().attemptTimeoutMs).toBe(8000);

    process.env.NOTIFICATION_ATTEMPT_TIMEOUT_MS = 'not-a-number';
    expect(getNotificationConfig().attemptTimeoutMs).toBe(8000);
  });
});
