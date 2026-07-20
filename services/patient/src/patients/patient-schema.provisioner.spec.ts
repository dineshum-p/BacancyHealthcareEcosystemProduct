import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { PatientSchemaProvisioner } from './patient-schema.provisioner';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

describe('PatientSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: PatientSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA acme');
    provisioner = new PatientSchemaProvisioner(pool);
  });

  it('creates the patients table and a seeded mrn counter row', async () => {
    await provisioner.ensurePatientsTable('acme');

    const counter = await pool.query<{ next_value: number }>(
      'SELECT next_value FROM acme.patient_mrn_counters WHERE id = 1',
    );
    expect(counter.rows[0].next_value).toBe(1);

    const patientsTable = await pool.query('SELECT * FROM acme.patients');
    expect(patientsTable.rows.length).toBe(0);
  });

  it('is idempotent -- calling it twice does not throw', async () => {
    await provisioner.ensurePatientsTable('acme');
    await expect(
      provisioner.ensurePatientsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('is idempotent even without the in-process cache (re-provisioning a schema that already has the tables)', async () => {
    await provisioner.ensurePatientsTable('acme');
    const freshProvisioner = new PatientSchemaProvisioner(pool);

    await expect(
      freshProvisioner.ensurePatientsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('creates the audit_logs table', async () => {
    await provisioner.ensureAuditLogsTable('acme');

    const table = await pool.query('SELECT * FROM acme.audit_logs');
    expect(table.rows.length).toBe(0);
  });

  it('ensureAuditLogsTable is idempotent', async () => {
    await provisioner.ensureAuditLogsTable('acme');
    await expect(
      provisioner.ensureAuditLogsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('ensureAuditLogsTable is idempotent even without the in-process cache', async () => {
    await provisioner.ensureAuditLogsTable('acme');
    const freshProvisioner = new PatientSchemaProvisioner(pool);

    await expect(
      freshProvisioner.ensureAuditLogsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('BAC-36: creates the patient_self_registrations table', async () => {
    await provisioner.ensureSelfRegistrationsTable('acme');

    const table = await pool.query(
      'SELECT * FROM acme.patient_self_registrations',
    );
    expect(table.rows.length).toBe(0);
  });

  it('BAC-36: ensureSelfRegistrationsTable is idempotent', async () => {
    await provisioner.ensureSelfRegistrationsTable('acme');
    await expect(
      provisioner.ensureSelfRegistrationsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('BAC-36: ensureSelfRegistrationsTable is idempotent even without the in-process cache', async () => {
    await provisioner.ensureSelfRegistrationsTable('acme');
    const freshProvisioner = new PatientSchemaProvisioner(pool);

    await expect(
      freshProvisioner.ensureSelfRegistrationsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('provisions two tenant schemas independently (separate mrn counters)', async () => {
    await pool.query('CREATE SCHEMA globex');

    await provisioner.ensurePatientsTable('acme');
    await provisioner.ensurePatientsTable('globex');

    const acmeCounter = await pool.query<{ next_value: number }>(
      'SELECT next_value FROM acme.patient_mrn_counters WHERE id = 1',
    );
    const globexCounter = await pool.query<{ next_value: number }>(
      'SELECT next_value FROM globex.patient_mrn_counters WHERE id = 1',
    );
    expect(acmeCounter.rows[0].next_value).toBe(1);
    expect(globexCounter.rows[0].next_value).toBe(1);
  });
});
