import { Pool, QueryResult } from 'pg';
import { PatientProfileRepository } from './patient-profile.repository';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

const SCHEMA = 'tenant_acme';
const PATIENT_ID = '22222222-2222-2222-2222-222222222222';

describe('PatientProfileRepository', () => {
  let pool: Pool;
  let repository: PatientProfileRepository;

  beforeEach(async () => {
    process.env.PGCRYPTO_COLUMN_KEY = 'e2e-test-column-key';
    pool = createInMemoryPool();
    await pool.query(`CREATE SCHEMA ${quoteSchemaIdentifier(SCHEMA)}`);
    await new EmrSchemaProvisioner(pool).ensurePatientProfilesTable(SCHEMA);
    repository = new PatientProfileRepository(pool);
  });

  describe('findByPatientId', () => {
    it('returns null when no profile exists yet for this patient', async () => {
      expect(await repository.findByPatientId(SCHEMA, PATIENT_ID)).toBeNull();
    });
  });

  describe('upsert', () => {
    it('creates a new profile when none exists, and decrypts the returned allergies/chronic conditions', async () => {
      const record = await repository.upsert(SCHEMA, PATIENT_ID, {
        allergies: [{ substance: 'Penicillin', severity: 'severe' }],
        chronicConditions: [{ name: 'Asthma' }],
        medications: [{ name: 'Albuterol', dosage: '90mcg' }],
      });

      expect(record.patientId).toBe(PATIENT_ID);
      expect(record.allergies).toEqual([
        { substance: 'Penicillin', severity: 'severe' },
      ]);
      expect(record.chronicConditions).toEqual([{ name: 'Asthma' }]);
      expect(record.medications).toEqual([
        { name: 'Albuterol', dosage: '90mcg' },
      ]);
    });

    it('edits the SAME row in place on a second call (upsert, not versioned) -- id is stable across updates', async () => {
      const first = await repository.upsert(SCHEMA, PATIENT_ID, {
        allergies: [{ substance: 'Penicillin' }],
        chronicConditions: [],
        medications: [],
      });

      const second = await repository.upsert(SCHEMA, PATIENT_ID, {
        allergies: [{ substance: 'Penicillin' }, { substance: 'Peanuts' }],
        chronicConditions: [{ name: 'Asthma' }],
        medications: [{ name: 'Albuterol' }],
      });

      expect(second.id).toBe(first.id);
      expect(second.allergies).toEqual([
        { substance: 'Penicillin' },
        { substance: 'Peanuts' },
      ]);
      expect(second.chronicConditions).toEqual([{ name: 'Asthma' }]);
      expect(second.medications).toEqual([{ name: 'Albuterol' }]);

      const rows: QueryResult<{ count: string }> = await pool.query(
        `SELECT count(*) AS count FROM ${quoteSchemaIdentifier(SCHEMA)}.patient_profiles`,
      );
      expect(Number(rows.rows[0].count)).toBe(1);
    });

    it('handles two concurrent upserts for a patient with no pre-existing row without throwing a unique_violation (23505)', async () => {
      const [first, second] = await Promise.all([
        repository.upsert(SCHEMA, PATIENT_ID, {
          allergies: [{ substance: 'Penicillin' }],
          chronicConditions: [],
          medications: [],
        }),
        repository.upsert(SCHEMA, PATIENT_ID, {
          allergies: [{ substance: 'Peanuts' }],
          chronicConditions: [{ name: 'Asthma' }],
          medications: [{ name: 'Albuterol' }],
        }),
      ]);

      // Both calls resolve successfully (no unhandled 23505) and agree on
      // the row's stable id -- exactly one profile row was ever created.
      expect(first.id).toBe(second.id);

      const rows: QueryResult<{ count: string }> = await pool.query(
        `SELECT count(*) AS count FROM ${quoteSchemaIdentifier(SCHEMA)}.patient_profiles`,
      );
      expect(Number(rows.rows[0].count)).toBe(1);

      // Whichever call's UPDATE lost the race falls through to an INSERT
      // that hits the UNIQUE(patient_id) violation left by the winner's
      // INSERT; that call must retry as an UPDATE against the winner's row
      // rather than surfacing the 23505 -- so the final row reflects ONE of
      // the two payloads in full (never a merge/corruption of both).
      const finalRecord = await repository.findByPatientId(SCHEMA, PATIENT_ID);
      expect(finalRecord).not.toBeNull();
      const matchesFirstPayload =
        finalRecord?.allergies.length === 1 &&
        finalRecord.allergies[0].substance === 'Penicillin';
      const matchesSecondPayload =
        finalRecord?.allergies.length === 1 &&
        finalRecord.allergies[0].substance === 'Peanuts';
      expect(matchesFirstPayload || matchesSecondPayload).toBe(true);
    });

    it('never returns an updatedAt earlier than createdAt after an edit', async () => {
      const first = await repository.upsert(SCHEMA, PATIENT_ID, {
        allergies: [],
        chronicConditions: [],
        medications: [],
      });
      const second = await repository.upsert(SCHEMA, PATIENT_ID, {
        allergies: [{ substance: 'Penicillin' }],
        chronicConditions: [],
        medications: [],
      });

      expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
      expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(
        first.updatedAt.getTime(),
      );
    });

    describe('PHI encryption (BAC-44): pgcrypto column-level round trip', () => {
      it('round-trips allergies/chronic conditions through pgp_sym_encrypt/pgp_sym_decrypt', async () => {
        const record = await repository.upsert(SCHEMA, PATIENT_ID, {
          allergies: [{ substance: 'Penicillin', reaction: 'Hives' }],
          chronicConditions: [{ name: 'Hypertension', notes: 'Stage 1' }],
          medications: [],
        });

        expect(record.allergies).toEqual([
          { substance: 'Penicillin', reaction: 'Hives' },
        ]);
        expect(record.chronicConditions).toEqual([
          { name: 'Hypertension', notes: 'Stage 1' },
        ]);

        // Re-reading via findByPatientId (a separate SELECT, not the
        // upsert's own RETURNING clause) must decrypt to the exact same
        // plaintext -- proving the round trip, not just that INSERT/UPDATE
        // and its own RETURNING happen to agree.
        const reread = await repository.findByPatientId(SCHEMA, PATIENT_ID);
        expect(reread?.allergies).toEqual([
          { substance: 'Penicillin', reaction: 'Hives' },
        ]);
        expect(reread?.chronicConditions).toEqual([
          { name: 'Hypertension', notes: 'Stage 1' },
        ]);
      });

      it('stores allergies/chronic_conditions as NON-plaintext bytes -- a raw SELECT never reveals the substance/condition name', async () => {
        await repository.upsert(SCHEMA, PATIENT_ID, {
          allergies: [{ substance: 'VerySensitivePenicillinAllergy' }],
          chronicConditions: [{ name: 'VerySensitiveHIVDiagnosis' }],
          medications: [],
        });

        const raw: QueryResult<{
          allergies: Buffer;
          chronic_conditions: Buffer;
        }> = await pool.query(
          `SELECT allergies, chronic_conditions FROM ${quoteSchemaIdentifier(SCHEMA)}.patient_profiles WHERE patient_id = $1`,
          [PATIENT_ID],
        );
        const rawAllergies = raw.rows[0].allergies;
        const rawChronicConditions = raw.rows[0].chronic_conditions;

        expect(Buffer.isBuffer(rawAllergies)).toBe(true);
        expect(Buffer.isBuffer(rawChronicConditions)).toBe(true);
        expect(rawAllergies.toString('latin1')).not.toContain(
          'VerySensitivePenicillinAllergy',
        );
        expect(rawChronicConditions.toString('latin1')).not.toContain(
          'VerySensitiveHIVDiagnosis',
        );
      });

      it('fails to decrypt (or produces garbage, never the original plaintext) with the WRONG key', async () => {
        await repository.upsert(SCHEMA, PATIENT_ID, {
          allergies: [{ substance: 'Penicillin' }],
          chronicConditions: [],
          medications: [],
        });

        await expect(
          pool.query(
            `SELECT pgp_sym_decrypt(allergies, $1) FROM ${quoteSchemaIdentifier(SCHEMA)}.patient_profiles WHERE patient_id = $2`,
            ['a-completely-different-key', PATIENT_ID],
          ),
        ).rejects.toThrow();
      });

      it('medications are NOT pgcrypto-encrypted (explicit ticket scope: allergies/chronic_conditions only)', async () => {
        await repository.upsert(SCHEMA, PATIENT_ID, {
          allergies: [],
          chronicConditions: [],
          medications: [{ name: 'Albuterol' }],
        });

        const raw: QueryResult<{ medications: unknown }> = await pool.query(
          `SELECT medications FROM ${quoteSchemaIdentifier(SCHEMA)}.patient_profiles WHERE patient_id = $1`,
          [PATIENT_ID],
        );
        expect(raw.rows[0].medications).toEqual([{ name: 'Albuterol' }]);
      });
    });
  });
});
