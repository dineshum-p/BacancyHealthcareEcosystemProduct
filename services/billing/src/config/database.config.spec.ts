import { getDatabaseConfig } from './database.config';

describe('getDatabaseConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to docker-compose.test.yml defaults when unset', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;

    expect(getDatabaseConfig()).toEqual({
      host: 'localhost',
      port: 5548,
      user: 'billing_service',
      password: 'billing_service',
      database: 'billing_service',
    });
  });

  it('reads overrides from the environment', () => {
    process.env.DB_HOST = 'db.internal';
    process.env.DB_PORT = '6543';
    process.env.DB_USER = 'custom_user';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_NAME = 'custom_db';

    expect(getDatabaseConfig()).toEqual({
      host: 'db.internal',
      port: 6543,
      user: 'custom_user',
      password: 'secret',
      database: 'custom_db',
    });
  });
});
