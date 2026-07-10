import { Pool } from 'pg';
import { EmrSchemaProvisioner } from './emr-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('EmrSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: EmrSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new EmrSchemaProvisioner(pool);
    await pool.query('CREATE SCHEMA "tenant_acme"');
  });

  describe('ensurePatientsTable', () => {
    it('creates a patients table storing a JSONB resource', async () => {
      await provisioner.ensurePatientsTable('tenant_acme');

      await pool.query(
        'INSERT INTO "tenant_acme".patients (id, resource) VALUES ($1, $2)',
        ['11111111-1111-1111-1111-111111111111', JSON.stringify({ a: 1 })],
      );
      const result = await pool.query(
        'SELECT resource FROM "tenant_acme".patients',
      );

      expect(result.rows).toEqual([{ resource: { a: 1 } }]);
    });

    it('is idempotent when called twice for the same schema', async () => {
      await provisioner.ensurePatientsTable('tenant_acme');
      await expect(
        provisioner.ensurePatientsTable('tenant_acme'),
      ).resolves.not.toThrow();
    });

    it('rejects unsafe schema names', async () => {
      await expect(
        provisioner.ensurePatientsTable('bad; drop table x;'),
      ).rejects.toThrow();
    });
  });

  describe('ensureAuditLogsTable', () => {
    it('creates an append-only audit_logs table', async () => {
      await provisioner.ensureAuditLogsTable('tenant_acme');

      await pool.query(
        `INSERT INTO "tenant_acme".audit_logs
           (id, actor_user_id, action, resource_type, resource_id, before, after)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          '11111111-1111-1111-1111-111111111111',
          'user-1',
          'create',
          'Patient',
          '1',
          null,
          JSON.stringify({ resourceType: 'Patient', id: '1' }),
        ],
      );
      const result = await pool.query(
        'SELECT actor_user_id, resource_type FROM "tenant_acme".audit_logs',
      );

      expect(result.rows).toEqual([
        { actor_user_id: 'user-1', resource_type: 'Patient' },
      ]);
    });

    it('is idempotent when called twice for the same schema', async () => {
      await provisioner.ensureAuditLogsTable('tenant_acme');
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
