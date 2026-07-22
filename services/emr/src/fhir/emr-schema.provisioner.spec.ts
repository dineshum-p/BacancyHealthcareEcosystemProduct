import { Pool, QueryResult } from 'pg';
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
        'INSERT INTO "tenant_acme".fhir_patients (id, resource) VALUES ($1, $2)',
        ['11111111-1111-1111-1111-111111111111', JSON.stringify({ a: 1 })],
      );
      const result = await pool.query(
        'SELECT resource FROM "tenant_acme".fhir_patients',
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

    it("does not collide with services/patient's own differently-shaped `patients` table in a shared database", async () => {
      // Reproduces services/patient's `PatientSchemaProvisioner.ensurePatientsTable`
      // DDL (BAC-14) against the SAME schema -- in local dev every service is
      // deliberately pointed at one shared Postgres database
      // (scripts/start-all-local.sh), so a schema this service's own
      // `ensurePatientsTable` provisions can already contain a `patients`
      // table created by `services/patient` instead, with none of this
      // service's expected `resource` JSONB column.
      await pool.query(`
        CREATE TABLE "tenant_acme".patients (
          id UUID PRIMARY KEY,
          mrn TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          date_of_birth DATE NOT NULL
        )
      `);

      await provisioner.ensurePatientsTable('tenant_acme');
      await pool.query(
        'INSERT INTO "tenant_acme".fhir_patients (id, resource) VALUES ($1, $2)',
        ['11111111-1111-1111-1111-111111111111', JSON.stringify({ a: 1 })],
      );
      const result = await pool.query(
        'SELECT resource FROM "tenant_acme".fhir_patients',
      );

      expect(result.rows).toEqual([{ resource: { a: 1 } }]);
    });
  });

  describe('ensureEncountersTable', () => {
    it('creates an encounters table storing SOAP fields, vitals, and a JSONB allergies list', async () => {
      await provisioner.ensureEncountersTable('tenant_acme');

      await pool.query(
        `INSERT INTO "tenant_acme".encounters
           (id, patient_id, subjective, objective, assessment, plan,
            heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
            temperature, respiratory_rate, spo2, allergies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          'Feels dizzy',
          'BP elevated',
          'Hypertension',
          'Start medication',
          80,
          120,
          80,
          37,
          16,
          98,
          JSON.stringify([{ substance: 'Penicillin', severity: 'severe' }]),
        ],
      );
      const result = await pool.query(
        'SELECT patient_id, subjective, allergies FROM "tenant_acme".encounters',
      );

      expect(result.rows).toEqual([
        {
          patient_id: '22222222-2222-2222-2222-222222222222',
          subjective: 'Feels dizzy',
          allergies: [{ substance: 'Penicillin', severity: 'severe' }],
        },
      ]);
    });

    it('is idempotent when called twice for the same schema', async () => {
      await provisioner.ensureEncountersTable('tenant_acme');
      await expect(
        provisioner.ensureEncountersTable('tenant_acme'),
      ).resolves.not.toThrow();
    });

    it('rejects unsafe schema names', async () => {
      await expect(
        provisioner.ensureEncountersTable('bad; drop table x;'),
      ).rejects.toThrow();
    });
  });

  describe('ensurePatientProfilesTable', () => {
    it('installs pgcrypto and creates a patient_profiles table with encrypted allergy/chronic-condition columns', async () => {
      await provisioner.ensurePatientProfilesTable('tenant_acme');

      await pool.query(
        `INSERT INTO "tenant_acme".patient_profiles
           (id, patient_id, allergies, chronic_conditions, medications)
         VALUES ($1, $2, pgp_sym_encrypt($3, $5), pgp_sym_encrypt($4, $5), $6)`,
        [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          JSON.stringify([{ substance: 'Penicillin', severity: 'severe' }]),
          JSON.stringify([{ name: 'Asthma' }]),
          'test-key',
          JSON.stringify([{ name: 'Albuterol' }]),
        ],
      );

      const raw: QueryResult<{ allergies: Buffer; medications: unknown }> =
        await pool.query(
          'SELECT allergies, medications FROM "tenant_acme".patient_profiles',
        );
      expect(Buffer.isBuffer(raw.rows[0].allergies)).toBe(true);
      expect(raw.rows[0].allergies.toString('latin1')).not.toContain(
        'Penicillin',
      );
      expect(raw.rows[0].medications).toEqual([{ name: 'Albuterol' }]);

      const decrypted: QueryResult<{
        allergies_json: string;
        chronic_conditions_json: string;
      }> = await pool.query(
        `SELECT pgp_sym_decrypt(allergies, $1) AS allergies_json,
                pgp_sym_decrypt(chronic_conditions, $1) AS chronic_conditions_json
         FROM "tenant_acme".patient_profiles`,
        ['test-key'],
      );
      expect(JSON.parse(decrypted.rows[0].allergies_json)).toEqual([
        { substance: 'Penicillin', severity: 'severe' },
      ]);
      expect(JSON.parse(decrypted.rows[0].chronic_conditions_json)).toEqual([
        { name: 'Asthma' },
      ]);
    });

    it('is idempotent when called twice for the same schema', async () => {
      await provisioner.ensurePatientProfilesTable('tenant_acme');
      await expect(
        provisioner.ensurePatientProfilesTable('tenant_acme'),
      ).resolves.not.toThrow();
    });

    it('rejects unsafe schema names', async () => {
      await expect(
        provisioner.ensurePatientProfilesTable('bad; drop table x;'),
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
