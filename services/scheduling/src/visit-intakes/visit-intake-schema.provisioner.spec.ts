import { Pool } from 'pg';
import { VisitIntakeSchemaProvisioner } from './visit-intake-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('VisitIntakeSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: VisitIntakeSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA acme');
    provisioner = new VisitIntakeSchemaProvisioner(pool);
  });

  it('creates the visit_intakes table', async () => {
    await provisioner.ensureVisitIntakesTable('acme');

    const table = await pool.query('SELECT * FROM acme.visit_intakes');
    expect(table.rows.length).toBe(0);
  });

  it('is idempotent -- calling it twice does not throw', async () => {
    await provisioner.ensureVisitIntakesTable('acme');
    await expect(
      provisioner.ensureVisitIntakesTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('is idempotent even without the in-process cache (re-provisioning a schema that already has the table)', async () => {
    await provisioner.ensureVisitIntakesTable('acme');
    const freshProvisioner = new VisitIntakeSchemaProvisioner(pool);

    await expect(
      freshProvisioner.ensureVisitIntakesTable('acme'),
    ).resolves.toBeUndefined();
  });

  it('provisions two tenant schemas independently', async () => {
    await pool.query('CREATE SCHEMA globex');

    await provisioner.ensureVisitIntakesTable('acme');
    await provisioner.ensureVisitIntakesTable('globex');

    const acmeTable = await pool.query('SELECT * FROM acme.visit_intakes');
    const globexTable = await pool.query('SELECT * FROM globex.visit_intakes');
    expect(acmeTable.rows.length).toBe(0);
    expect(globexTable.rows.length).toBe(0);
  });

  it('installs pgcrypto and allows pgp_sym_encrypt/pgp_sym_decrypt against the new table', async () => {
    await provisioner.ensureVisitIntakesTable('acme');

    await pool.query(
      `INSERT INTO acme.visit_intakes
         (id, patient_id, reason_for_visit, symptoms, whats_new_since_last_visit)
       VALUES ($1, $2, pgp_sym_encrypt($3, $6), pgp_sym_encrypt($4, $6), pgp_sym_encrypt($5, $6))`,
      [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'Follow-up visit',
        'Fatigue',
        '',
        'test-key',
      ],
    );

    const raw = await pool.query<{ reason_for_visit: Buffer }>(
      'SELECT reason_for_visit FROM acme.visit_intakes',
    );
    expect(Buffer.isBuffer(raw.rows[0].reason_for_visit)).toBe(true);
    expect(raw.rows[0].reason_for_visit.toString('latin1')).not.toContain(
      'Follow-up visit',
    );

    const decrypted = await pool.query<{ reason_for_visit: string }>(
      `SELECT pgp_sym_decrypt(reason_for_visit, $1) AS reason_for_visit FROM acme.visit_intakes`,
      ['test-key'],
    );
    expect(decrypted.rows[0].reason_for_visit).toBe('Follow-up visit');
  });
});
