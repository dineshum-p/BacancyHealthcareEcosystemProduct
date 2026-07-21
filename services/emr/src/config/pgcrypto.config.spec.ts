import { getPgcryptoConfig } from './pgcrypto.config';

describe('getPgcryptoConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to the dev-only default when unset', () => {
    delete process.env.PGCRYPTO_COLUMN_KEY;

    expect(getPgcryptoConfig()).toEqual({
      columnEncryptionKey: 'dev-insecure-column-encryption-key-change-me',
    });
  });

  it('reads an override from the environment', () => {
    process.env.PGCRYPTO_COLUMN_KEY = 'super-secret-column-key';

    expect(getPgcryptoConfig()).toEqual({
      columnEncryptionKey: 'super-secret-column-key',
    });
  });

  it('throws in production when PGCRYPTO_COLUMN_KEY is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PGCRYPTO_COLUMN_KEY;

    expect(() => getPgcryptoConfig()).toThrow(/PGCRYPTO_COLUMN_KEY/);
  });

  it('throws in production when PGCRYPTO_COLUMN_KEY equals the dev placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.PGCRYPTO_COLUMN_KEY =
      'dev-insecure-column-encryption-key-change-me';

    expect(() => getPgcryptoConfig()).toThrow(/PGCRYPTO_COLUMN_KEY/);
  });

  it('throws when NODE_ENV is unset (treated as a real deployment) and the key is missing', () => {
    delete process.env.NODE_ENV;
    delete process.env.PGCRYPTO_COLUMN_KEY;

    expect(() => getPgcryptoConfig()).toThrow(/PGCRYPTO_COLUMN_KEY/);
  });

  it('throws in production when PGCRYPTO_COLUMN_KEY is an empty string', () => {
    process.env.NODE_ENV = 'production';
    process.env.PGCRYPTO_COLUMN_KEY = '';

    expect(() => getPgcryptoConfig()).toThrow(/PGCRYPTO_COLUMN_KEY/);
  });

  it('throws in production when PGCRYPTO_COLUMN_KEY is whitespace-only', () => {
    process.env.NODE_ENV = 'production';
    process.env.PGCRYPTO_COLUMN_KEY = '   ';

    expect(() => getPgcryptoConfig()).toThrow(/PGCRYPTO_COLUMN_KEY/);
  });

  it('does not throw in production when a real key is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.PGCRYPTO_COLUMN_KEY = 'a-strong-random-production-key';

    expect(() => getPgcryptoConfig()).not.toThrow();
    expect(getPgcryptoConfig().columnEncryptionKey).toBe(
      'a-strong-random-production-key',
    );
  });

  it('still falls back to the dev placeholder in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.PGCRYPTO_COLUMN_KEY;

    expect(() => getPgcryptoConfig()).not.toThrow();
    expect(getPgcryptoConfig().columnEncryptionKey).toBe(
      'dev-insecure-column-encryption-key-change-me',
    );
  });
});
