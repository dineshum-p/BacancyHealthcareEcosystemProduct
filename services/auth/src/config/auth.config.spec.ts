import { getAuthConfig } from './auth.config';

describe('getAuthConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to dev-only defaults when unset', () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.ACCESS_TOKEN_TTL_SECONDS;
    delete process.env.REFRESH_TOKEN_TTL_SECONDS;
    delete process.env.MFA_ENCRYPTION_KEY;

    expect(getAuthConfig()).toEqual({
      jwtAccessSecret: 'dev-insecure-access-secret-change-me',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604800,
      mfaEncryptionKey: 'dev-insecure-mfa-key-change-me',
    });
  });

  it('reads overrides from the environment', () => {
    process.env.JWT_ACCESS_SECRET = 'super-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '120';
    process.env.REFRESH_TOKEN_TTL_SECONDS = '3600';
    process.env.MFA_ENCRYPTION_KEY = 'super-secret-mfa-key';

    expect(getAuthConfig()).toEqual({
      jwtAccessSecret: 'super-secret',
      accessTokenTtlSeconds: 120,
      refreshTokenTtlSeconds: 3600,
      mfaEncryptionKey: 'super-secret-mfa-key',
    });
  });

  it('throws in production when JWT_ACCESS_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;

    expect(() => getAuthConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws in production when JWT_ACCESS_SECRET equals the dev placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'dev-insecure-access-secret-change-me';

    expect(() => getAuthConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws when NODE_ENV is unset (treated as a real deployment) and the secret is missing', () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_ACCESS_SECRET;

    expect(() => getAuthConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws in production when JWT_ACCESS_SECRET is an empty string', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = '';

    expect(() => getAuthConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws in production when JWT_ACCESS_SECRET is whitespace-only', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = '   ';

    expect(() => getAuthConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('does not throw in production when a real secret is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a-strong-random-production-secret';
    process.env.MFA_ENCRYPTION_KEY = 'a-strong-random-production-mfa-key';

    expect(() => getAuthConfig()).not.toThrow();
    expect(getAuthConfig().jwtAccessSecret).toBe(
      'a-strong-random-production-secret',
    );
  });

  it('still falls back to the dev placeholder in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.MFA_ENCRYPTION_KEY;

    expect(() => getAuthConfig()).not.toThrow();
    expect(getAuthConfig().jwtAccessSecret).toBe(
      'dev-insecure-access-secret-change-me',
    );
  });

  it('throws in production when MFA_ENCRYPTION_KEY is unset (even with a real JWT secret)', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a-strong-random-production-secret';
    delete process.env.MFA_ENCRYPTION_KEY;

    expect(() => getAuthConfig()).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it('throws in production when MFA_ENCRYPTION_KEY equals the dev placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a-strong-random-production-secret';
    process.env.MFA_ENCRYPTION_KEY = 'dev-insecure-mfa-key-change-me';

    expect(() => getAuthConfig()).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it('throws in production when MFA_ENCRYPTION_KEY is blank/whitespace-only', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a-strong-random-production-secret';
    process.env.MFA_ENCRYPTION_KEY = '   ';

    expect(() => getAuthConfig()).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it('still falls back to the MFA dev placeholder in test/development', () => {
    delete process.env.MFA_ENCRYPTION_KEY;

    expect(() => getAuthConfig()).not.toThrow();
    expect(getAuthConfig().mfaEncryptionKey).toBe(
      'dev-insecure-mfa-key-change-me',
    );
  });
});
