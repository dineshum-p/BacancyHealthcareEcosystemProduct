import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { BillingSchemaProvisioner } from './billing-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('BillingSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: BillingSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new BillingSchemaProvisioner(pool);
    await pool.query('CREATE SCHEMA "tenant_acme"');
  });

  describe('ensureUsageEventsTable', () => {
    it('creates a usage_events table and enforces uniqueness on event_id', async () => {
      await provisioner.ensureUsageEventsTable('tenant_acme');

      await pool.query(
        `INSERT INTO "tenant_acme".usage_events (id, event_id, metric, quantity, occurred_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), 'evt-1', 'patient.created', 1, '2026-07-01T00:00:00Z'],
      );

      await expect(
        pool.query(
          `INSERT INTO "tenant_acme".usage_events (id, event_id, metric, quantity, occurred_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), 'evt-1', 'patient.created', 1, '2026-07-01T00:00:00Z'],
        ),
      ).rejects.toThrow();
    });

    it('is idempotent when called twice for the same schema', async () => {
      await provisioner.ensureUsageEventsTable('tenant_acme');
      await expect(
        provisioner.ensureUsageEventsTable('tenant_acme'),
      ).resolves.not.toThrow();
    });

    it('rejects unsafe schema names', async () => {
      await expect(
        provisioner.ensureUsageEventsTable('bad; drop table x;'),
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
          randomUUID(),
          'user-1',
          'create',
          'UsageEvent',
          'evt-1',
          null,
          JSON.stringify({ eventId: 'evt-1' }),
        ],
      );
      const result = await pool.query(
        'SELECT actor_user_id, resource_type FROM "tenant_acme".audit_logs',
      );

      expect(result.rows).toEqual([
        { actor_user_id: 'user-1', resource_type: 'UsageEvent' },
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
