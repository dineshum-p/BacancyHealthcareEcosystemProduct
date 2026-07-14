import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { EncountersRepository } from './encounters.repository';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('EncountersRepository', () => {
  const SCHEMA = 'tenant_a';
  let pool: Pool;
  let repository: EncountersRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query(`CREATE SCHEMA ${SCHEMA}`);
    await new EmrSchemaProvisioner(pool).ensureEncountersTable(SCHEMA);
    repository = new EncountersRepository(pool);
  });

  describe('insert', () => {
    it('persists a full encounter (SOAP note + vitals + allergies) and returns it back', async () => {
      const patientId = randomUUID();

      const created = await repository.insert(SCHEMA, patientId, {
        subjective: 'Dizzy',
        objective: 'BP elevated',
        assessment: 'Hypertension',
        plan: 'Start medication',
        heartRate: 88,
        bloodPressureSystolic: 150,
        bloodPressureDiastolic: 95,
        temperature: 37.2,
        respiratoryRate: 18,
        spO2: 97,
        allergies: [{ substance: 'Penicillin', severity: 'severe' }],
      });

      expect(created.id).toEqual(expect.any(String));
      expect(created.patientId).toBe(patientId);
      expect(created.subjective).toBe('Dizzy');
      expect(created.heartRate).toBe(88);
      expect(created.allergies).toEqual([
        { substance: 'Penicillin', severity: 'severe' },
      ]);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it('persists an encounter with no vitals/allergies as null vitals and an empty allergies list', async () => {
      const patientId = randomUUID();

      const created = await repository.insert(SCHEMA, patientId, {
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        allergies: [],
      });

      expect(created.heartRate).toBeNull();
      expect(created.bloodPressureSystolic).toBeNull();
      expect(created.allergies).toEqual([]);
    });
  });

  describe('findByPatientId', () => {
    it('returns an empty array when the patient has no encounters', async () => {
      await expect(
        repository.findByPatientId(SCHEMA, randomUUID()),
      ).resolves.toEqual([]);
    });

    it('returns only the given patient encounters, most recent first', async () => {
      const patientId = randomUUID();
      const otherPatientId = randomUUID();

      const first = await repository.insert(SCHEMA, patientId, {
        subjective: 'First visit',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        allergies: [],
      });
      const second = await repository.insert(SCHEMA, patientId, {
        subjective: 'Second visit',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        allergies: [],
      });
      await repository.insert(SCHEMA, otherPatientId, {
        subjective: 'Other patient visit',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        allergies: [],
      });

      const result = await repository.findByPatientId(SCHEMA, patientId);

      expect(result.map((r) => r.id)).toEqual([second.id, first.id]);
    });

    it('does not find an encounter that only exists in a different schema (tenant isolation)', async () => {
      await pool.query('CREATE SCHEMA tenant_b');
      await new EmrSchemaProvisioner(pool).ensureEncountersTable('tenant_b');
      const patientId = randomUUID();
      await repository.insert('tenant_b', patientId, {
        subjective: 'Other tenant',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        allergies: [],
      });

      await expect(
        repository.findByPatientId(SCHEMA, patientId),
      ).resolves.toEqual([]);
    });
  });
});
