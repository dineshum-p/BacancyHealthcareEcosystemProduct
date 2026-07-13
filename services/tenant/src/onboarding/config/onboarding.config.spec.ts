import { getOnboardingConfig } from './onboarding.config';

describe('getOnboardingConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to dev-only defaults when unset', () => {
    delete process.env.AUTH_SERVICE_URL;
    delete process.env.NOTIFICATION_SERVICE_URL;
    delete process.env.INTERNAL_SERVICE_KEY;
    delete process.env.ONBOARDING_REQUEST_TIMEOUT_MS;

    expect(getOnboardingConfig()).toEqual({
      authServiceUrl: 'http://localhost:3001',
      notificationServiceUrl: 'http://localhost:3003',
      internalServiceKey: 'dev-insecure-internal-service-key-change-me',
      requestTimeoutMs: 5000,
    });
  });

  it('reads overrides from the environment', () => {
    process.env.AUTH_SERVICE_URL = 'http://auth.internal';
    process.env.NOTIFICATION_SERVICE_URL = 'http://notification.internal';
    process.env.INTERNAL_SERVICE_KEY = 'super-secret-internal-key';
    process.env.ONBOARDING_REQUEST_TIMEOUT_MS = '1234';

    expect(getOnboardingConfig()).toEqual({
      authServiceUrl: 'http://auth.internal',
      notificationServiceUrl: 'http://notification.internal',
      internalServiceKey: 'super-secret-internal-key',
      requestTimeoutMs: 1234,
    });
  });

  it('throws in production when INTERNAL_SERVICE_KEY is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(() => getOnboardingConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('throws in production when INTERNAL_SERVICE_KEY equals the dev placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY =
      'dev-insecure-internal-service-key-change-me';

    expect(() => getOnboardingConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('does not throw in production when a real key is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY = 'a-strong-random-production-key';

    expect(() => getOnboardingConfig()).not.toThrow();
  });

  it('still falls back to the dev placeholder in test/development', () => {
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(() => getOnboardingConfig()).not.toThrow();
    expect(getOnboardingConfig().internalServiceKey).toBe(
      'dev-insecure-internal-service-key-change-me',
    );
  });
});
