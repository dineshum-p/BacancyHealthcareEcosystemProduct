import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentSchemaProvisioner } from './appointment-schema.provisioner';
import { AppointmentStatus } from './appointment-status.enum';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

const DAY = '2026-07-20';

function at(hour: number, minute = 0): Date {
  return new Date(
    `${DAY}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
  );
}

describe('AppointmentsRepository', () => {
  let pool: Pool;
  let repository: AppointmentsRepository;
  let provisioner: AppointmentSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new AppointmentSchemaProvisioner(pool);
    repository = new AppointmentsRepository(pool);
    await pool.query('CREATE SCHEMA acme');
    await provisioner.ensureAppointmentsTable('acme');
  });

  describe('insert', () => {
    it('books a new appointment with status "booked"', async () => {
      const record = await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });

      expect(record.id).toEqual(expect.any(String));
      expect(record.providerId).toBe('provider-1');
      expect(record.patientId).toBe('patient-1');
      expect(record.status).toBe(AppointmentStatus.BOOKED);
      expect(record.startTime).toEqual(at(9));
      expect(record.endTime).toEqual(at(9, 30));
    });
  });

  describe('hasConflict (AC1: double-booking the same slot returns 409)', () => {
    beforeEach(async () => {
      await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });
    });

    it('detects an exact-match overlap for the same provider', async () => {
      const conflict = await repository.hasConflict(
        'acme',
        'provider-1',
        at(9),
        at(9, 30),
      );
      expect(conflict).toBe(true);
    });

    it('detects a partial-overlap conflict', async () => {
      const conflict = await repository.hasConflict(
        'acme',
        'provider-1',
        at(9, 15),
        at(9, 45),
      );
      expect(conflict).toBe(true);
    });

    it('does not conflict for a back-to-back (non-overlapping) slot', async () => {
      const conflict = await repository.hasConflict(
        'acme',
        'provider-1',
        at(9, 30),
        at(10),
      );
      expect(conflict).toBe(false);
    });

    it('does not conflict for a DIFFERENT provider at the same time', async () => {
      const conflict = await repository.hasConflict(
        'acme',
        'provider-2',
        at(9),
        at(9, 30),
      );
      expect(conflict).toBe(false);
    });

    it('excludes a given appointment id from the conflict check (for reschedule)', async () => {
      const existing = await repository.insert('acme', {
        providerId: 'provider-3',
        patientId: 'patient-2',
        startTime: at(11),
        endTime: at(11, 30),
      });

      const conflict = await repository.hasConflict(
        'acme',
        'provider-3',
        at(11),
        at(11, 30),
        existing.id,
      );
      expect(conflict).toBe(false);
    });

    it('does not conflict with a CANCELLED appointment', async () => {
      const cancelMe = await repository.insert('acme', {
        providerId: 'provider-4',
        patientId: 'patient-3',
        startTime: at(13),
        endTime: at(13, 30),
      });
      await repository.cancel('acme', cancelMe.id);

      const conflict = await repository.hasConflict(
        'acme',
        'provider-4',
        at(13),
        at(13, 30),
      );
      expect(conflict).toBe(false);
    });
  });

  describe('findByProviderAndRange (AC2: day schedule)', () => {
    beforeEach(async () => {
      await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });
      await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-2',
        startTime: at(14),
        endTime: at(14, 30),
      });
      await repository.insert('acme', {
        providerId: 'provider-2',
        patientId: 'patient-3',
        startTime: at(10),
        endTime: at(10, 30),
      });
    });

    it("returns only the requested provider's appointments for the day, ordered by start time", async () => {
      const dayStart = new Date(`${DAY}T00:00:00.000Z`);
      const dayEnd = new Date(`${DAY}T23:59:59.999Z`);

      const results = await repository.findByProviderAndRange(
        'acme',
        'provider-1',
        dayStart,
        dayEnd,
      );

      expect(results).toHaveLength(2);
      expect(results[0].patientId).toBe('patient-1');
      expect(results[1].patientId).toBe('patient-2');
    });

    it('excludes appointments outside the requested range', async () => {
      const dayStart = new Date(`${DAY}T00:00:00.000Z`);
      const dayEnd = new Date(`${DAY}T12:00:00.000Z`);

      const results = await repository.findByProviderAndRange(
        'acme',
        'provider-1',
        dayStart,
        dayEnd,
      );

      expect(results).toHaveLength(1);
      expect(results[0].patientId).toBe('patient-1');
    });

    it("never returns a different tenant schema's appointments", async () => {
      await pool.query('CREATE SCHEMA globex');
      await provisioner.ensureAppointmentsTable('globex');
      await repository.insert('globex', {
        providerId: 'provider-1',
        patientId: 'other-patient',
        startTime: at(9),
        endTime: at(9, 30),
      });

      const dayStart = new Date(`${DAY}T00:00:00.000Z`);
      const dayEnd = new Date(`${DAY}T23:59:59.999Z`);
      const results = await repository.findByProviderAndRange(
        'acme',
        'provider-1',
        dayStart,
        dayEnd,
      );

      expect(results.every((r) => r.patientId !== 'other-patient')).toBe(true);
    });
  });

  describe('updateTimes (AC3: reschedule)', () => {
    it('updates the time range of a booked appointment', async () => {
      const existing = await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });

      const updated = await repository.updateTimes(
        'acme',
        existing.id,
        at(15),
        at(15, 30),
      );

      expect(updated).not.toBeNull();
      expect(updated?.startTime).toEqual(at(15));
      expect(updated?.endTime).toEqual(at(15, 30));
      expect(updated?.status).toBe(AppointmentStatus.BOOKED);
    });

    it('returns null when the appointment is already cancelled', async () => {
      const existing = await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });
      await repository.cancel('acme', existing.id);

      const updated = await repository.updateTimes(
        'acme',
        existing.id,
        at(15),
        at(15, 30),
      );
      expect(updated).toBeNull();
    });

    it('returns null for an unknown id', async () => {
      const updated = await repository.updateTimes(
        'acme',
        randomUUID(),
        at(15),
        at(15, 30),
      );
      expect(updated).toBeNull();
    });
  });

  describe('cancel (AC3)', () => {
    it('transitions a booked appointment to cancelled', async () => {
      const existing = await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });

      const updated = await repository.cancel('acme', existing.id);

      expect(updated?.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('returns null when already cancelled (no-op, not a re-cancel)', async () => {
      const existing = await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });
      await repository.cancel('acme', existing.id);

      const secondCancel = await repository.cancel('acme', existing.id);
      expect(secondCancel).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns null for an unknown id', async () => {
      const found = await repository.findById('acme', randomUUID());
      expect(found).toBeNull();
    });

    it('returns the appointment for a known id', async () => {
      const existing = await repository.insert('acme', {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: at(9),
        endTime: at(9, 30),
      });

      const found = await repository.findById('acme', existing.id);
      expect(found?.id).toBe(existing.id);
    });
  });
});
