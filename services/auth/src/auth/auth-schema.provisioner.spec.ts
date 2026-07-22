import { Pool } from 'pg';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';

describe('AuthSchemaProvisioner', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA "tenant_acme"');
  });

  it('creates the users and refresh_tokens tables in the tenant schema', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');

    await expect(
      pool.query('SELECT * FROM "tenant_acme".users'),
    ).resolves.toMatchObject({ rows: [] });
    await expect(
      pool.query('SELECT * FROM "tenant_acme".refresh_tokens'),
    ).resolves.toMatchObject({ rows: [] });
  });

  it('creates the users table with MFA columns defaulted to "none"/null (BAC-6)', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');
    await pool.query(
      `INSERT INTO "tenant_acme".users (id, email, password_hash, role)
       VALUES ('11111111-1111-1111-1111-111111111111', 'ada@example.com', 'hash', 'member')`,
    );

    const result = await pool.query(
      'SELECT mfa_status, mfa_secret_encrypted, mfa_last_used_step FROM "tenant_acme".users',
    );
    expect(result.rows[0]).toEqual({
      mfa_status: 'none',
      mfa_secret_encrypted: null,
      mfa_last_used_step: null,
    });
  });

  it('creates the users table with firstName/lastName/dateOfBirth columns defaulted to null (BAC-42)', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');
    await pool.query(
      `INSERT INTO "tenant_acme".users (id, email, password_hash, role)
       VALUES ('22222222-2222-2222-2222-222222222222', 'no-name@example.com', 'hash', 'staff')`,
    );

    const result = await pool.query(
      'SELECT first_name, last_name, date_of_birth FROM "tenant_acme".users',
    );
    expect(result.rows[0]).toEqual({
      first_name: null,
      last_name: null,
      date_of_birth: null,
    });
  });

  it('creates the users table with BAC-48 provider-account columns defaulted to null/false', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');
    await pool.query(
      `INSERT INTO "tenant_acme".users (id, email, password_hash, role)
       VALUES ('33333333-3333-3333-3333-333333333333', 'no-gender@example.com', 'hash', 'staff')`,
    );

    const result = await pool.query(
      'SELECT gender, phone, address, must_reset_password FROM "tenant_acme".users',
    );
    expect(result.rows[0]).toEqual({
      gender: null,
      phone: null,
      address: null,
      must_reset_password: false,
    });
  });

  it('adds the BAC-48 provider-account columns to a users table that already existed without them', async () => {
    // Simulates a tenant schema provisioned before BAC-48 shipped.
    await pool.query(
      `CREATE TABLE "tenant_acme".users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        mfa_status TEXT NOT NULL DEFAULT 'none',
        mfa_secret_encrypted TEXT NULL,
        mfa_last_used_step BIGINT NULL,
        first_name TEXT NULL,
        last_name TEXT NULL,
        date_of_birth DATE NULL,
        UNIQUE (email)
      )`,
    );
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');

    await expect(
      pool.query(
        'SELECT gender, phone, address, must_reset_password FROM "tenant_acme".users',
      ),
    ).resolves.toMatchObject({ rows: [] });
  });

  it('adds the BAC-42 identity columns to a users table that already existed without them', async () => {
    // Simulates a tenant schema provisioned before BAC-42 shipped.
    await pool.query(
      `CREATE TABLE "tenant_acme".users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        mfa_status TEXT NOT NULL DEFAULT 'none',
        mfa_secret_encrypted TEXT NULL,
        mfa_last_used_step BIGINT NULL,
        UNIQUE (email)
      )`,
    );
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');

    await expect(
      pool.query(
        'SELECT first_name, last_name, date_of_birth FROM "tenant_acme".users',
      ),
    ).resolves.toMatchObject({ rows: [] });
  });

  it('creates the mfa_recovery_codes table in the tenant schema (BAC-6)', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');

    await expect(
      pool.query('SELECT * FROM "tenant_acme".mfa_recovery_codes'),
    ).resolves.toMatchObject({ rows: [] });
  });

  it('adds the MFA columns to a users table that already existed without them', async () => {
    // Simulates a tenant schema provisioned before BAC-6 shipped.
    await pool.query(
      `CREATE TABLE "tenant_acme".users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (email)
      )`,
    );
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');

    await expect(
      pool.query(
        'SELECT mfa_status, mfa_secret_encrypted, mfa_last_used_step FROM "tenant_acme".users',
      ),
    ).resolves.toMatchObject({ rows: [] });
  });

  it('is idempotent -- calling it twice for the same schema does not throw', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await provisioner.ensureProvisioned('tenant_acme');
    await expect(
      provisioner.ensureProvisioned('tenant_acme'),
    ).resolves.toBeUndefined();
  });

  it('caches successfully-provisioned schemas so it does not re-issue DDL', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);
    await provisioner.ensureProvisioned('tenant_acme');

    const querySpy = jest.spyOn(pool, 'query');
    await provisioner.ensureProvisioned('tenant_acme');

    expect(querySpy).not.toHaveBeenCalled();
  });

  it('rejects an unsafe schema name rather than issuing DDL', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);

    await expect(
      provisioner.ensureProvisioned('bad; drop table x;'),
    ).rejects.toThrow();
  });

  it('re-throws unrelated errors from table creation', async () => {
    const provisioner = new AuthSchemaProvisioner(pool);
    // No schema exists for this tenant, so CREATE TABLE fails for a reason
    // other than "already exists".
    await expect(
      provisioner.ensureProvisioned('tenant_missing'),
    ).rejects.toThrow();
  });

  it('quotes/validates the schema name the same way the rest of the codebase does', () => {
    expect(() => quoteSchemaIdentifier('tenant_acme')).not.toThrow();
  });
});
