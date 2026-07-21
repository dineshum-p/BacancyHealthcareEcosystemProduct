import { getNotificationClientConfig } from './notification-client.config';

describe('getNotificationClientConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to local dev defaults when unset', () => {
    delete process.env.NOTIFICATION_SERVICE_URL;
    delete process.env.INTERNAL_SERVICE_KEY;
    delete process.env.NOTIFICATION_REQUEST_TIMEOUT_MS;

    expect(getNotificationClientConfig()).toEqual({
      notificationServiceUrl: 'http://localhost:3004',
      internalServiceKey: 'dev-insecure-internal-service-key-change-me',
      requestTimeoutMs: 5000,
    });
  });

  it('reads overrides from the environment', () => {
    process.env.NOTIFICATION_SERVICE_URL = 'http://notification.internal';
    process.env.INTERNAL_SERVICE_KEY = 'a-strong-random-key';
    process.env.NOTIFICATION_REQUEST_TIMEOUT_MS = '2000';

    expect(getNotificationClientConfig()).toEqual({
      notificationServiceUrl: 'http://notification.internal',
      internalServiceKey: 'a-strong-random-key',
      requestTimeoutMs: 2000,
    });
  });

  it('throws in production when INTERNAL_SERVICE_KEY is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(() => getNotificationClientConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('throws in production when INTERNAL_SERVICE_KEY equals the dev placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY =
      'dev-insecure-internal-service-key-change-me';

    expect(() => getNotificationClientConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('does not throw in production when a real key is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY = 'a-strong-random-key';

    expect(() => getNotificationClientConfig()).not.toThrow();
  });
});
