import { Pool } from 'pg';
import { TenantSchemaProvisioner } from './tenant-schema-provisioner';
import { createInMemoryPool } from '../../../test/support/create-in-memory-pool';

describe('TenantSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: TenantSchemaProvisioner;

  beforeEach(() => {
    pool = createInMemoryPool();
    provisioner = new TenantSchemaProvisioner(pool);
  });

  it('creates an isolated schema with a sample items table', async () => {
    await provisioner.provision('tenant_acme');

    await pool.query('INSERT INTO "tenant_acme".items (name) VALUES ($1)', [
      'first',
    ]);
    const result = await pool.query('SELECT name FROM "tenant_acme".items');

    expect(result.rows).toEqual([{ name: 'first' }]);
  });

  it('is idempotent when called twice for the same schema', async () => {
    await provisioner.provision('tenant_acme');
    await expect(provisioner.provision('tenant_acme')).resolves.not.toThrow();
  });

  it('rejects unsafe schema names', async () => {
    await expect(provisioner.provision('bad; drop table x;')).rejects.toThrow();
  });
});
