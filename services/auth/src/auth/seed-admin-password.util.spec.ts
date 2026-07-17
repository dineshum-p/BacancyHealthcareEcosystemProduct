import {
  DEV_SEED_ADMIN_PASSWORD,
  resolveSeedAdminPassword,
} from './seed-admin-password.util';

describe('resolveSeedAdminPassword', () => {
  it('returns the known dev password under development', () => {
    expect(resolveSeedAdminPassword('development')).toBe(
      DEV_SEED_ADMIN_PASSWORD,
    );
  });

  it('returns the known dev password under test', () => {
    expect(resolveSeedAdminPassword('test')).toBe(DEV_SEED_ADMIN_PASSWORD);
  });

  it('returns an unguessable random password in production', () => {
    const password = resolveSeedAdminPassword('production');

    expect(password).not.toBe(DEV_SEED_ADMIN_PASSWORD);
    expect(password.length).toBeGreaterThanOrEqual(32);
  });

  it('treats an unset NODE_ENV as a real deployment (random, not the dev password)', () => {
    // The default parameter reads process.env.NODE_ENV, so exercise the
    // genuinely-unset path by clearing it and calling with no argument.
    const original = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const password = resolveSeedAdminPassword();

      expect(password).not.toBe(DEV_SEED_ADMIN_PASSWORD);
      expect(password.length).toBeGreaterThanOrEqual(32);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('generates a different random value on each non-dev call', () => {
    expect(resolveSeedAdminPassword('production')).not.toBe(
      resolveSeedAdminPassword('production'),
    );
  });
});
