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
