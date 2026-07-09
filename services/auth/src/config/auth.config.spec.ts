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
});
