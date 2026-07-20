import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { PatientSelfRegistrationsRepository } from './patient-self-registrations.repository';
import { PatientSchemaProvisioner } from '../patient-schema.provisioner';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

describe('PatientSelfRegistrationsRepository', () => {
  let pool: Pool;
  let repository: PatientSelfRegistrationsRepository;
  let provisioner: PatientSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new PatientSchemaProvisioner(pool);
    repository = new PatientSelfRegistrationsRepository(pool);
    await pool.query('CREATE SCHEMA acme');
    await provisioner.ensureSelfRegistrationsTable('acme');
  });

  describe('insert', () => {
    it('creates a pending self-registration with no matched patient', async () => {
      const record = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(record.id).toEqual(expect.any(String));
      expect(record.status).toBe('pending');
      expect(record.matchedPatientId).toBeNull();
      expect(record.matchReason).toBeNull();
      expect(record.resultingPatientId).toBeNull();
      expect(record.reviewedBy).toBeNull();
      expect(record.reviewedAt).toBeNull();
    });

    it('persists a duplicate-detection candidate when one is supplied', async () => {
      const record = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        matchedPatientId: 'patient-1',
        matchReason: 'name_dob',
      });

      expect(record.matchedPatientId).toBe('patient-1');
      expect(record.matchReason).toBe('name_dob');
    });
  });

  describe('findById', () => {
    it('returns the self-registration matching the given id', async () => {
      const inserted = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      const found = await repository.findById('acme', inserted.id);
      expect(found?.id).toBe(inserted.id);
    });

    it('returns null when no self-registration matches the given id', async () => {
      const found = await repository.findById(
        'acme',
        '00000000-0000-0000-0000-000000000000',
      );
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('lists every self-registration, newest first, when no status filter is given', async () => {
      const first = await repository.insert('acme', {
        firstName: 'First',
        lastName: 'Person',
        dateOfBirth: '1990-01-01',
      });
      const second = await repository.insert('acme', {
        firstName: 'Second',
        lastName: 'Person',
        dateOfBirth: '1991-01-01',
      });

      const all = await repository.list('acme');
      expect(all.map((r) => r.id)).toEqual([second.id, first.id]);
    });

    it('filters by status', async () => {
      const pending = await repository.insert('acme', {
        firstName: 'Pending',
        lastName: 'Person',
        dateOfBirth: '1990-01-01',
      });
      const toApprove = await repository.insert('acme', {
        firstName: 'ToApprove',
        lastName: 'Person',
        dateOfBirth: '1990-01-01',
      });
      await repository.review('acme', toApprove.id, {
        status: 'approved',
        resultingPatientId: 'patient-1',
        reviewedBy: 'staff-1',
      });

      const pendingOnly = await repository.list('acme', 'pending');
      expect(pendingOnly.map((r) => r.id)).toEqual([pending.id]);

      const approvedOnly = await repository.list('acme', 'approved');
      expect(approvedOnly.map((r) => r.id)).toEqual([toApprove.id]);
    });

    it('never lists self-registrations from a different tenant schema', async () => {
      await pool.query('CREATE SCHEMA globex');
      await provisioner.ensureSelfRegistrationsTable('globex');
      await repository.insert('globex', {
        firstName: 'Other',
        lastName: 'Tenant',
        dateOfBirth: '1999-09-09',
      });

      const acmeList = await repository.list('acme');
      expect(acmeList).toHaveLength(0);
    });
  });

  describe('review', () => {
    it('approves a pending self-registration, recording the resulting patient and reviewer', async () => {
      const pending = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      const reviewed = await repository.review('acme', pending.id, {
        status: 'approved',
        resultingPatientId: 'new-patient-id',
        reviewedBy: 'staff-user-1',
      });

      expect(reviewed.status).toBe('approved');
      expect(reviewed.resultingPatientId).toBe('new-patient-id');
      expect(reviewed.reviewedBy).toBe('staff-user-1');
      expect(reviewed.reviewedAt).toBeInstanceOf(Date);
    });

    it('rejects a pending self-registration, recording an optional review note', async () => {
      const pending = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      const reviewed = await repository.review('acme', pending.id, {
        status: 'rejected',
        reviewNote: 'Could not verify identity.',
        reviewedBy: 'staff-user-1',
      });

      expect(reviewed.status).toBe('rejected');
      expect(reviewed.resultingPatientId).toBeNull();
      expect(reviewed.reviewNote).toBe('Could not verify identity.');
    });

    it('merges a pending self-registration into an existing patient', async () => {
      const pending = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        matchedPatientId: 'existing-patient-id',
        matchReason: 'name_dob',
      });

      const reviewed = await repository.review('acme', pending.id, {
        status: 'merged',
        resultingPatientId: 'existing-patient-id',
        reviewedBy: 'staff-user-1',
      });

      expect(reviewed.status).toBe('merged');
      expect(reviewed.resultingPatientId).toBe('existing-patient-id');
    });

    it('throws when reviewing a self-registration id that does not exist', async () => {
      await expect(
        repository.review('acme', '00000000-0000-0000-0000-000000000000', {
          status: 'approved',
          reviewedBy: 'staff-user-1',
        }),
      ).rejects.toThrow(/no such row/);
    });
  });
});
