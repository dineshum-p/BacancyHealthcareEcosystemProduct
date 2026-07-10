import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuditLogsRepository } from './audit-logs.repository';
import { BillingSchemaProvisioner } from '../usage/billing-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('AuditLogsRepository', () => {
  let pool: Pool;
  let provisioner: BillingSchemaProvisioner;
  let repository: AuditLogsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new BillingSchemaProvisioner(pool);
    repository = new AuditLogsRepository(pool, provisioner);
    await pool.query('CREATE SCHEMA "tenant_acme"');
  });

  it('persists an entry retrievable via findAll', async () => {
    await repository.insert('tenant_acme', {
      id: randomUUID(),
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'UsageEvent',
      resourceId: 'evt-1',
      before: null,
      after: { eventId: 'evt-1', metric: 'patient.created', quantity: 1 },
    });

    const items = await repository.findAll('tenant_acme');

    expect(items).toEqual([
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'UsageEvent',
        resourceId: 'evt-1',
        before: null,
        after: { eventId: 'evt-1', metric: 'patient.created', quantity: 1 },
      }),
    ]);
    expect(items[0].createdAt).toBeInstanceOf(Date);
  });

  it('lazily provisions the audit_logs table for a schema that predates this table', async () => {
    await pool.query('CREATE SCHEMA IF NOT EXISTS "tenant_legacy"');

    await expect(
      repository.insert('tenant_legacy', {
        id: randomUUID(),
        actorUserId: null,
        action: 'create',
        resourceType: 'UsageEvent',
        resourceId: 'evt-legacy',
        before: null,
        after: { eventId: 'evt-legacy' },
      }),
    ).resolves.not.toThrow();
  });

  it('never returns rows from a different tenant schema', async () => {
    await pool.query('CREATE SCHEMA "tenant_other"');
    await repository.insert('tenant_acme', {
      id: randomUUID(),
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'UsageEvent',
      resourceId: 'evt-1',
      before: null,
      after: { eventId: 'evt-1' },
    });
    await repository.insert('tenant_other', {
      id: randomUUID(),
      actorUserId: 'user-2',
      action: 'create',
      resourceType: 'UsageEvent',
      resourceId: 'evt-2',
      before: null,
      after: { eventId: 'evt-2' },
    });

    const items = await repository.findAll('tenant_acme');

    expect(items).toHaveLength(1);
    expect(items[0].resourceId).toBe('evt-1');
  });
});
