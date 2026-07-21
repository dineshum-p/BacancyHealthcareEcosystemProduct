import { randomUUID } from 'node:crypto';
import { Pool, QueryResult } from 'pg';
import { VisitIntakesRepository } from './visit-intakes.repository';
import { VisitIntakeSchemaProvisioner } from './visit-intake-schema.provisioner';
import { VisitIntakeStatus } from './visit-intake-status.enum';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

const SCHEMA = 'tenant_acme';
const PATIENT_ID = '22222222-2222-2222-2222-222222222222';

describe('VisitIntakesRepository', () => {
  let pool: Pool;
  let repository: VisitIntakesRepository;

  beforeEach(async () => {
    process.env.SCHEDULING_PGCRYPTO_COLUMN_KEY = 'e2e-test-column-key';
    pool = createInMemoryPool();
    await pool.query(`CREATE SCHEMA ${quoteSchemaIdentifier(SCHEMA)}`);
    await new VisitIntakeSchemaProvisioner(pool).ensureVisitIntakesTable(
      SCHEMA,
    );
    repository = new VisitIntakesRepository(pool);
  });

  describe('insert', () => {
    it('creates a new, pending intake decrypted back to its original plaintext', async () => {
      const record = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Recurring migraines',
        symptoms: 'Throbbing pain, light sensitivity',
        whatsNewSinceLastVisit: 'Started a new job, more stress',
      });

      expect(record.id).toEqual(expect.any(String));
      expect(record.patientId).toBe(PATIENT_ID);
      expect(record.reasonForVisit).toBe('Recurring migraines');
      expect(record.symptoms).toBe('Throbbing pain, light sensitivity');
      expect(record.whatsNewSinceLastVisit).toBe(
        'Started a new job, more stress',
      );
      expect(record.status).toBe(VisitIntakeStatus.PENDING);
      expect(record.assignedProviderId).toBeNull();
      expect(record.appointmentId).toBeNull();
    });

    it('creates a BRAND NEW row on every call for the same patient (never merges/upserts)', async () => {
      await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'First visit reason',
        symptoms: 'First visit symptoms',
        whatsNewSinceLastVisit: '',
      });
      await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Second, unrelated visit reason',
        symptoms: 'Second visit symptoms',
        whatsNewSinceLastVisit: '',
      });

      const rows: QueryResult<{ count: string }> = await pool.query(
        `SELECT count(*) AS count FROM ${quoteSchemaIdentifier(SCHEMA)}.visit_intakes WHERE patient_id = $1`,
        [PATIENT_ID],
      );
      expect(Number(rows.rows[0].count)).toBe(2);

      const all = await repository.list(SCHEMA);
      expect(all.map((r) => r.reasonForVisit).sort()).toEqual(
        ['First visit reason', 'Second, unrelated visit reason'].sort(),
      );
    });
  });

  describe('findById', () => {
    it('returns null for an unknown id', async () => {
      expect(await repository.findById(SCHEMA, randomUUID())).toBeNull();
    });

    it('returns the decrypted intake for a known id', async () => {
      const created = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Sore throat',
        symptoms: 'Difficulty swallowing',
        whatsNewSinceLastVisit: '',
      });

      const found = await repository.findById(SCHEMA, created.id);
      expect(found?.reasonForVisit).toBe('Sore throat');
      expect(found?.symptoms).toBe('Difficulty swallowing');
    });
  });

  describe('list (AC2: staff triage queue)', () => {
    it('lists only pending intakes when status=pending', async () => {
      const pending = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Pending reason',
        symptoms: 'Pending symptoms',
        whatsNewSinceLastVisit: '',
      });
      const toLink = await repository.insert(SCHEMA, {
        patientId: 'other-patient',
        reasonForVisit: 'Will be linked',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });
      await repository.link(SCHEMA, toLink.id, {
        assignedProviderId: 'provider-1',
        appointmentId: 'appt-1',
      });

      const results = await repository.list(SCHEMA, 'pending');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(pending.id);
    });

    it('lists every intake tenant-wide when status is omitted', async () => {
      await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'One',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });
      await repository.insert(SCHEMA, {
        patientId: 'other-patient',
        reasonForVisit: 'Two',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });

      const results = await repository.list(SCHEMA);
      expect(results).toHaveLength(2);
    });

    it("never returns a different tenant schema's intakes", async () => {
      const otherSchema = 'tenant_globex';
      await pool.query(`CREATE SCHEMA ${quoteSchemaIdentifier(otherSchema)}`);
      await new VisitIntakeSchemaProvisioner(pool).ensureVisitIntakesTable(
        otherSchema,
      );
      await repository.insert(otherSchema, {
        patientId: 'globex-patient',
        reasonForVisit: 'Globex reason',
        symptoms: 'Globex symptoms',
        whatsNewSinceLastVisit: '',
      });

      const results = await repository.list(SCHEMA);
      expect(results).toHaveLength(0);
    });
  });

  describe('link (AC3)', () => {
    it('associates a provider + appointment with a pending intake, transitioning to linked', async () => {
      const created = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Reason',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });

      const linked = await repository.link(SCHEMA, created.id, {
        assignedProviderId: 'provider-1',
        appointmentId: 'appt-1',
      });

      expect(linked?.status).toBe(VisitIntakeStatus.LINKED);
      expect(linked?.assignedProviderId).toBe('provider-1');
      expect(linked?.appointmentId).toBe('appt-1');
    });

    it('returns null for an unknown id', async () => {
      const linked = await repository.link(SCHEMA, randomUUID(), {
        assignedProviderId: 'provider-1',
        appointmentId: 'appt-1',
      });
      expect(linked).toBeNull();
    });

    it('returns null (never updates) for an intake that is no longer pending -- atomic check-and-set at the DB level', async () => {
      const created = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Reason',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });
      await repository.link(SCHEMA, created.id, {
        assignedProviderId: 'provider-1',
        appointmentId: 'appt-1',
      });

      const secondAttempt = await repository.link(SCHEMA, created.id, {
        assignedProviderId: 'provider-2',
        appointmentId: 'appt-2',
      });

      expect(secondAttempt).toBeNull();
      const final = await repository.findById(SCHEMA, created.id);
      expect(final?.assignedProviderId).toBe('provider-1');
      expect(final?.appointmentId).toBe('appt-1');
    });

    it('regression (BLOCKER): two concurrent link() calls on the same pending intake -- exactly one wins (non-null), the other returns null (no silent overwrite, no crash)', async () => {
      const created = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Reason',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });

      const [first, second] = await Promise.all([
        repository.link(SCHEMA, created.id, {
          assignedProviderId: 'provider-first',
          appointmentId: 'appt-first',
        }),
        repository.link(SCHEMA, created.id, {
          assignedProviderId: 'provider-second',
          appointmentId: 'appt-second',
        }),
      ]);

      const results = [first, second];
      const winners = results.filter(
        (result): result is NonNullable<typeof result> => result !== null,
      );
      const losers = results.filter((result) => result === null);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      // The persisted row reflects EXACTLY the winner -- never a mix of
      // both racing calls' provider/appointment pairs.
      const final = await repository.findById(SCHEMA, created.id);
      expect(final?.status).toBe(VisitIntakeStatus.LINKED);
      expect(final?.assignedProviderId).toBe(winners[0].assignedProviderId);
      expect(final?.appointmentId).toBe(winners[0].appointmentId);
    });
  });

  describe('PHI encryption (BAC-45): pgcrypto column-level round trip', () => {
    it('round-trips reasonForVisit/symptoms/whatsNewSinceLastVisit through pgp_sym_encrypt/pgp_sym_decrypt', async () => {
      const created = await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Chest tightness',
        symptoms: 'Shortness of breath, dizziness',
        whatsNewSinceLastVisit: 'Started smoking again',
      });

      // Re-reading via findById (a separate SELECT, not the insert's own
      // RETURNING clause) must decrypt to the exact same plaintext --
      // proving the round trip, not just that INSERT and its own RETURNING
      // happen to agree.
      const reread = await repository.findById(SCHEMA, created.id);
      expect(reread?.reasonForVisit).toBe('Chest tightness');
      expect(reread?.symptoms).toBe('Shortness of breath, dizziness');
      expect(reread?.whatsNewSinceLastVisit).toBe('Started smoking again');
    });

    it('stores reason_for_visit/symptoms as NON-plaintext bytes -- a raw SELECT never reveals the content', async () => {
      await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'VerySensitiveReasonForVisit',
        symptoms: 'VerySensitiveSymptomDescription',
        whatsNewSinceLastVisit: 'VerySensitiveUpdate',
      });

      const raw: QueryResult<{
        reason_for_visit: Buffer;
        symptoms: Buffer;
        whats_new_since_last_visit: Buffer;
      }> = await pool.query(
        `SELECT reason_for_visit, symptoms, whats_new_since_last_visit
         FROM ${quoteSchemaIdentifier(SCHEMA)}.visit_intakes
         WHERE patient_id = $1`,
        [PATIENT_ID],
      );
      const row = raw.rows[0];

      expect(Buffer.isBuffer(row.reason_for_visit)).toBe(true);
      expect(Buffer.isBuffer(row.symptoms)).toBe(true);
      expect(Buffer.isBuffer(row.whats_new_since_last_visit)).toBe(true);
      expect(row.reason_for_visit.toString('latin1')).not.toContain(
        'VerySensitiveReasonForVisit',
      );
      expect(row.symptoms.toString('latin1')).not.toContain(
        'VerySensitiveSymptomDescription',
      );
      expect(row.whats_new_since_last_visit.toString('latin1')).not.toContain(
        'VerySensitiveUpdate',
      );
    });

    it('fails to decrypt (or produces garbage, never the original plaintext) with the WRONG key', async () => {
      await repository.insert(SCHEMA, {
        patientId: PATIENT_ID,
        reasonForVisit: 'Reason',
        symptoms: 'Symptoms',
        whatsNewSinceLastVisit: '',
      });

      await expect(
        pool.query(
          `SELECT pgp_sym_decrypt(reason_for_visit, $1) FROM ${quoteSchemaIdentifier(SCHEMA)}.visit_intakes WHERE patient_id = $2`,
          ['a-completely-different-key', PATIENT_ID],
        ),
      ).rejects.toThrow();
    });
  });
});
