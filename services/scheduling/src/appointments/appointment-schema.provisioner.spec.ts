import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { AppointmentSchemaProvisioner } from './appointment-schema.provisioner';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

describe('AppointmentSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: AppointmentSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA acme');
    provisioner = new AppointmentSchemaProvisioner(pool);
  });

  it('creates the appointments table', async () => {
    await provisioner.ensureAppointmentsTable('acme');

    const table = await pool.query('SELECT * FROM acme.appointments');
    expect(table.rows.length).toBe(0);
  });

  it('is idempotent -- calling it twice does not throw', async () => {
    await provisioner.ensureAppointmentsTable('acme');
    await expect(
      provisioner.ensureAppointmentsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('is idempotent even without the in-process cache (re-provisioning a schema that already has the table)', async () => {
    await provisioner.ensureAppointmentsTable('acme');
    const freshProvisioner = new AppointmentSchemaProvisioner(pool);

    await expect(
      freshProvisioner.ensureAppointmentsTable('acme'),
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
    const freshProvisioner = new AppointmentSchemaProvisioner(pool);

    await expect(
      freshProvisioner.ensureAuditLogsTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('provisions two tenant schemas independently', async () => {
    await pool.query('CREATE SCHEMA globex');

    await provisioner.ensureAppointmentsTable('acme');
    await provisioner.ensureAppointmentsTable('globex');

    const acmeTable = await pool.query('SELECT * FROM acme.appointments');
    const globexTable = await pool.query('SELECT * FROM globex.appointments');
    expect(acmeTable.rows.length).toBe(0);
    expect(globexTable.rows.length).toBe(0);
  });
});
