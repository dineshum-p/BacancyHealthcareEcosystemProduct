import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuditLogsRepository } from './audit-logs.repository';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('AuditLogsRepository', () => {
  let pool: Pool;
  let provisioner: EmrSchemaProvisioner;
  let repository: AuditLogsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new EmrSchemaProvisioner(pool);
    repository = new AuditLogsRepository(pool, provisioner);
    await pool.query('CREATE SCHEMA "tenant_acme"');
  });

  it('persists an entry retrievable via findAll', async () => {
    await repository.insert('tenant_acme', {
      id: randomUUID(),
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      before: null,
      after: { resourceType: 'Patient', id: 'patient-1' },
    });

    const items = await repository.findAll('tenant_acme');

    expect(items).toEqual([
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'Patient',
        resourceId: 'patient-1',
        before: null,
        after: { resourceType: 'Patient', id: 'patient-1' },
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
        resourceType: 'Patient',
        resourceId: 'patient-legacy',
        before: null,
        after: { resourceType: 'Patient', id: 'patient-legacy' },
      }),
    ).resolves.not.toThrow();
  });

  it('never returns rows from a different tenant schema', async () => {
    await pool.query('CREATE SCHEMA "tenant_other"');
    await repository.insert('tenant_acme', {
      id: randomUUID(),
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'p1',
      before: null,
      after: { id: 'p1' },
    });
    await repository.insert('tenant_other', {
      id: randomUUID(),
      actorUserId: 'user-2',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'p2',
      before: null,
      after: { id: 'p2' },
    });

    const items = await repository.findAll('tenant_acme');

    expect(items).toHaveLength(1);
    expect(items[0].resourceId).toBe('p1');
  });
});
