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

  it('provisions an append-only audit_logs table alongside items (BAC-8, AC5)', async () => {
    await provisioner.provision('tenant_acme');

    await pool.query(
      `INSERT INTO "tenant_acme".audit_logs
         (id, actor_user_id, action, resource_type, resource_id, before, after)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        '11111111-1111-1111-1111-111111111111',
        'user-1',
        'create',
        'item',
        '1',
        null,
        JSON.stringify({ id: 1, name: 'widget' }),
      ],
    );
    const result = await pool.query(
      'SELECT actor_user_id, action, resource_type, resource_id, before, after FROM "tenant_acme".audit_logs',
    );

    expect(result.rows).toEqual([
      {
        actor_user_id: 'user-1',
        action: 'create',
        resource_type: 'item',
        resource_id: '1',
        before: null,
        after: { id: 1, name: 'widget' },
      },
    ]);
  });

  describe('ensureAuditLogsTable', () => {
    it('lazily creates the audit_logs table for a schema that predates BAC-8', async () => {
      // Simulates a tenant schema provisioned by an OLDER version of this
      // service, before `provision()` created `audit_logs` -- e.g. an
      // already-onboarded tenant in a real deployment.
      await pool.query('CREATE SCHEMA IF NOT EXISTS "tenant_legacy"');
      await pool.query(
        'CREATE TABLE "tenant_legacy".items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
      );

      await provisioner.ensureAuditLogsTable('tenant_legacy');

      await expect(
        pool.query('SELECT * FROM "tenant_legacy".audit_logs'),
      ).resolves.toMatchObject({ rows: [] });
    });

    it('is idempotent when called twice for the same schema', async () => {
      await provisioner.provision('tenant_acme');
      await expect(
        provisioner.ensureAuditLogsTable('tenant_acme'),
      ).resolves.not.toThrow();
    });

    it('rejects unsafe schema names', async () => {
      await expect(
        provisioner.ensureAuditLogsTable('bad; drop table x;'),
      ).rejects.toThrow();
    });
  });
});
