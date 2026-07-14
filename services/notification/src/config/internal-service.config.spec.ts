import { getInternalServiceConfig } from './internal-service.config';

describe('getInternalServiceConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to the dev-only default when unset', () => {
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(getInternalServiceConfig()).toEqual({
      internalServiceKey: 'dev-insecure-internal-service-key-change-me',
    });
  });

  it('reads an override from the environment', () => {
    process.env.INTERNAL_SERVICE_KEY = 'super-secret-internal-key';

    expect(getInternalServiceConfig()).toEqual({
      internalServiceKey: 'super-secret-internal-key',
    });
  });

  it('throws in production when INTERNAL_SERVICE_KEY is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(() => getInternalServiceConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('throws in production when INTERNAL_SERVICE_KEY equals the dev placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY =
      'dev-insecure-internal-service-key-change-me';

    expect(() => getInternalServiceConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('throws in production when INTERNAL_SERVICE_KEY is blank/whitespace-only', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY = '   ';

    expect(() => getInternalServiceConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('throws when NODE_ENV is unset (treated as a real deployment) and the key is missing', () => {
    delete process.env.NODE_ENV;
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(() => getInternalServiceConfig()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('does not throw in production when a real key is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_SERVICE_KEY = 'a-strong-random-production-key';

    expect(() => getInternalServiceConfig()).not.toThrow();
    expect(getInternalServiceConfig().internalServiceKey).toBe(
      'a-strong-random-production-key',
    );
  });

  it('still falls back to the dev placeholder in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.INTERNAL_SERVICE_KEY;

    expect(() => getInternalServiceConfig()).not.toThrow();
    expect(getInternalServiceConfig().internalServiceKey).toBe(
      'dev-insecure-internal-service-key-change-me',
    );
  });
});
