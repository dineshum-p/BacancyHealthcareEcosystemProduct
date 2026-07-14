import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { AuditLogsRepository } from './audit-logs.repository';
import { PatientSchemaProvisioner } from '../patients/patient-schema.provisioner';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

describe('AuditLogsRepository', () => {
  let pool: Pool;
  let repository: AuditLogsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA acme');
    repository = new AuditLogsRepository(
      pool,
      new PatientSchemaProvisioner(pool),
    );
  });

  it('inserts and reads back an audit log entry', async () => {
    const id = randomUUID();
    await repository.insert('acme', {
      id,
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      before: null,
      after: { id: 'patient-1', mrn: 'MRN-000001' },
    });

    const entries = await repository.findAll('acme');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id,
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      before: null,
      after: { id: 'patient-1', mrn: 'MRN-000001' },
    });
  });

  it('records a null actorUserId and after as-is', async () => {
    await repository.insert('acme', {
      id: randomUUID(),
      actorUserId: null,
      action: 'create',
      resourceType: 'Patient',
      resourceId: null,
      before: null,
      after: null,
    });

    const entries = await repository.findAll('acme');
    expect(entries[0].actorUserId).toBeNull();
    expect(entries[0].resourceId).toBeNull();
    expect(entries[0].after).toBeNull();
  });

  it('lazily provisions the audit_logs table on first insert', async () => {
    await expect(
      repository.insert('acme', {
        id: randomUUID(),
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'Patient',
        resourceId: 'patient-1',
        before: null,
        after: { id: 'patient-1' },
      }),
    ).resolves.toBeUndefined();
  });
});
