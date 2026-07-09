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

    expect(getAuthConfig()).toEqual({
      jwtAccessSecret: 'dev-insecure-access-secret-change-me',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604800,
    });
  });

  it('reads overrides from the environment', () => {
    process.env.JWT_ACCESS_SECRET = 'super-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '120';
    process.env.REFRESH_TOKEN_TTL_SECONDS = '3600';

    expect(getAuthConfig()).toEqual({
      jwtAccessSecret: 'super-secret',
      accessTokenTtlSeconds: 120,
      refreshTokenTtlSeconds: 3600,
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

    expect(() => getAuthConfig()).not.toThrow();
    expect(getAuthConfig().jwtAccessSecret).toBe(
      'a-strong-random-production-secret',
    );
  });

  it('still falls back to the dev placeholder in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;

    expect(() => getAuthConfig()).not.toThrow();
    expect(getAuthConfig().jwtAccessSecret).toBe(
      'dev-insecure-access-secret-change-me',
    );
  });
});
