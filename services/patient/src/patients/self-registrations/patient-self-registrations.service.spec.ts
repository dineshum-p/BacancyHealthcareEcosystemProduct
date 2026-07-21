import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientSelfRegistrationsService } from './patient-self-registrations.service';
import {
  PatientSelfRegistrationsRepository,
  ReviewSelfRegistrationInput,
} from './patient-self-registrations.repository';
import { PatientsRepository } from '../patients.repository';
import { PatientSchemaProvisioner } from '../patient-schema.provisioner';
import { DomainEventPublisher } from '../../events/domain-event-publisher.interface';

const PENDING_RECORD = {
  id: 'self-reg-1',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: new Date('1990-05-12T00:00:00.000Z'),
  gender: null,
  phone: null,
  email: null,
  status: 'pending' as const,
  matchedPatientId: null,
  matchReason: null,
  resultingPatientId: null,
  reviewNote: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
};

describe('PatientSelfRegistrationsService', () => {
  function makeService(overrides?: {
    insertSelfRegistration?: jest.Mock;
    findByIdSelfRegistration?: jest.Mock;
    listSelfRegistrations?: jest.Mock;
    reviewSelfRegistration?: jest.Mock;
    findPotentialDuplicate?: jest.Mock;
    insertPatient?: jest.Mock;
    findByIdPatient?: jest.Mock;
    publishPatientCreated?: jest.Mock;
  }) {
    const insertSelfRegistration =
      overrides?.insertSelfRegistration ??
      jest.fn().mockResolvedValue(PENDING_RECORD);
    const findByIdSelfRegistration =
      overrides?.findByIdSelfRegistration ??
      jest.fn().mockResolvedValue(PENDING_RECORD);
    const listSelfRegistrations =
      overrides?.listSelfRegistrations ?? jest.fn().mockResolvedValue([]);
    const reviewSelfRegistration =
      overrides?.reviewSelfRegistration ??
      jest
        .fn()
        .mockImplementation(
          (_schema: string, _id: string, input: ReviewSelfRegistrationInput) =>
            Promise.resolve({
              ...PENDING_RECORD,
              status: input.status,
              resultingPatientId: input.resultingPatientId ?? null,
              reviewNote: input.reviewNote ?? null,
              reviewedBy: input.reviewedBy,
              reviewedAt: new Date('2026-07-20T01:00:00.000Z'),
            }),
        );

    const findPotentialDuplicate =
      overrides?.findPotentialDuplicate ?? jest.fn().mockResolvedValue(null);
    const insertPatient =
      overrides?.insertPatient ??
      jest.fn().mockResolvedValue({
        id: 'patient-1',
        mrn: 'MRN-000001',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-05-12T00:00:00.000Z'),
        gender: null,
        phone: null,
        email: null,
        createdAt: new Date('2026-07-20T01:00:00.000Z'),
        updatedAt: new Date('2026-07-20T01:00:00.000Z'),
      });
    const findByIdPatient =
      overrides?.findByIdPatient ??
      jest.fn().mockResolvedValue({
        id: 'existing-patient-1',
        mrn: 'MRN-000002',
        firstName: 'Existing',
        lastName: 'Patient',
        dateOfBirth: new Date('1980-01-01T00:00:00.000Z'),
        gender: null,
        phone: null,
        email: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
    const publishPatientCreated =
      overrides?.publishPatientCreated ??
      jest.fn().mockResolvedValue(undefined);

    const selfRegistrationsRepository = {
      insert: insertSelfRegistration,
      findById: findByIdSelfRegistration,
      list: listSelfRegistrations,
      review: reviewSelfRegistration,
    } as unknown as PatientSelfRegistrationsRepository;

    const patientsRepository = {
      findPotentialDuplicate,
      insert: insertPatient,
      findById: findByIdPatient,
    } as unknown as PatientsRepository;

    const schemaProvisioner = {
      ensurePatientsTable: jest.fn().mockResolvedValue(undefined),
      ensureSelfRegistrationsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as PatientSchemaProvisioner;

    const eventPublisher = {
      publishPatientCreated,
    } as unknown as DomainEventPublisher;

    const service = new PatientSelfRegistrationsService(
      selfRegistrationsRepository,
      patientsRepository,
      schemaProvisioner,
      eventPublisher,
    );

    return {
      service,
      insertSelfRegistration,
      findByIdSelfRegistration,
      listSelfRegistrations,
      reviewSelfRegistration,
      findPotentialDuplicate,
      insertPatient,
      findByIdPatient,
      publishPatientCreated,
    };
  }

  describe('register (public submission)', () => {
    it('stores a pending self-registration with no matched patient when duplicate detection finds nothing', async () => {
      const { service, insertSelfRegistration } = makeService();

      const receipt = await service.register('tenant-1', 'acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(insertSelfRegistration).toHaveBeenCalledWith('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        gender: undefined,
        phone: undefined,
        email: undefined,
        matchedPatientId: null,
        matchReason: null,
      });
      expect(receipt).toEqual({
        id: 'self-reg-1',
        tenantId: 'tenant-1',
        status: 'pending',
        createdAt: '2026-07-20T00:00:00.000Z',
      });
    });

    it('flags a probable duplicate match instead of auto-creating a patient', async () => {
      const findPotentialDuplicate = jest.fn().mockResolvedValue({
        patient: { id: 'existing-patient-1' },
        matchReason: 'name_dob',
      });
      const { service, insertSelfRegistration } = makeService({
        findPotentialDuplicate,
      });

      await service.register('tenant-1', 'acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(insertSelfRegistration).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({
          matchedPatientId: 'existing-patient-1',
          matchReason: 'name_dob',
        }),
      );
    });

    it('never inserts a new patients row on submission, matched or not', async () => {
      const findPotentialDuplicate = jest.fn().mockResolvedValue({
        patient: { id: 'existing-patient-1' },
        matchReason: 'name_dob',
      });
      const { service, insertPatient } = makeService({
        findPotentialDuplicate,
      });

      await service.register('tenant-1', 'acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(insertPatient).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('maps self-registration records to summaries', async () => {
      const listSelfRegistrations = jest
        .fn()
        .mockResolvedValue([PENDING_RECORD]);
      const { service } = makeService({ listSelfRegistrations });

      const result = await service.list('tenant-1', 'acme', 'pending');

      expect(listSelfRegistrations).toHaveBeenCalledWith('acme', 'pending');
      expect(result).toEqual([
        {
          id: 'self-reg-1',
          tenantId: 'tenant-1',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
          gender: null,
          phone: null,
          email: null,
          status: 'pending',
          matchedPatientId: null,
          matchReason: null,
          resultingPatientId: null,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('approve', () => {
    it('creates a real patient (with MRN), marks the registration approved, and publishes patient.created', async () => {
      const {
        service,
        insertPatient,
        reviewSelfRegistration,
        publishPatientCreated,
      } = makeService();

      const result = await service.approve(
        'tenant-1',
        'acme',
        'self-reg-1',
        'staff-user-1',
      );

      expect(insertPatient).toHaveBeenCalledWith('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        gender: undefined,
        phone: undefined,
        email: undefined,
      });
      expect(reviewSelfRegistration).toHaveBeenCalledWith(
        'acme',
        'self-reg-1',
        {
          status: 'approved',
          resultingPatientId: 'patient-1',
          reviewedBy: 'staff-user-1',
        },
      );
      expect(publishPatientCreated).toHaveBeenCalledWith({
        eventId: 'patient-1',
        patientId: 'patient-1',
        tenantId: 'tenant-1',
        createdAt: '2026-07-20T01:00:00.000Z',
      });
      expect(result.status).toBe('approved');
      expect(result.resultingPatientId).toBe('patient-1');
    });

    it('throws NotFoundException when the self-registration does not exist', async () => {
      const findByIdSelfRegistration = jest.fn().mockResolvedValue(null);
      const { service } = makeService({ findByIdSelfRegistration });

      await expect(
        service.approve('tenant-1', 'acme', 'missing', 'staff-user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException (409) when already reviewed', async () => {
      const findByIdSelfRegistration = jest
        .fn()
        .mockResolvedValue({ ...PENDING_RECORD, status: 'approved' });
      const { service } = makeService({ findByIdSelfRegistration });

      await expect(
        service.approve('tenant-1', 'acme', 'self-reg-1', 'staff-user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('never publishes patient.created if the self-registration is not pending', async () => {
      const findByIdSelfRegistration = jest
        .fn()
        .mockResolvedValue({ ...PENDING_RECORD, status: 'rejected' });
      const { service, publishPatientCreated } = makeService({
        findByIdSelfRegistration,
      });

      await expect(
        service.approve('tenant-1', 'acme', 'self-reg-1', 'staff-user-1'),
      ).rejects.toThrow(ConflictException);
      expect(publishPatientCreated).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('marks the registration rejected with an optional review note, and never creates a patient', async () => {
      const { service, reviewSelfRegistration, insertPatient } = makeService();

      const result = await service.reject(
        'tenant-1',
        'acme',
        'self-reg-1',
        'Could not verify identity.',
        'staff-user-1',
      );

      expect(reviewSelfRegistration).toHaveBeenCalledWith(
        'acme',
        'self-reg-1',
        {
          status: 'rejected',
          reviewNote: 'Could not verify identity.',
          reviewedBy: 'staff-user-1',
        },
      );
      expect(insertPatient).not.toHaveBeenCalled();
      expect(result.status).toBe('rejected');
    });

    it('throws ConflictException (409) when already reviewed', async () => {
      const findByIdSelfRegistration = jest
        .fn()
        .mockResolvedValue({ ...PENDING_RECORD, status: 'merged' });
      const { service } = makeService({ findByIdSelfRegistration });

      await expect(
        service.reject(
          'tenant-1',
          'acme',
          'self-reg-1',
          undefined,
          'staff-user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('merge', () => {
    it('links the self-registration to the target patient without creating a new one', async () => {
      const {
        service,
        reviewSelfRegistration,
        insertPatient,
        findByIdPatient,
      } = makeService();

      const result = await service.merge(
        'tenant-1',
        'acme',
        'self-reg-1',
        'existing-patient-1',
        'staff-user-1',
      );

      expect(findByIdPatient).toHaveBeenCalledWith(
        'acme',
        'existing-patient-1',
      );
      expect(insertPatient).not.toHaveBeenCalled();
      expect(reviewSelfRegistration).toHaveBeenCalledWith(
        'acme',
        'self-reg-1',
        {
          status: 'merged',
          resultingPatientId: 'existing-patient-1',
          reviewedBy: 'staff-user-1',
        },
      );
      expect(result.status).toBe('merged');
      expect(result.resultingPatientId).toBe('existing-patient-1');
    });

    it('throws NotFoundException when the target patient does not exist in this tenant', async () => {
      const findByIdPatient = jest.fn().mockResolvedValue(null);
      const { service } = makeService({ findByIdPatient });

      await expect(
        service.merge(
          'tenant-1',
          'acme',
          'self-reg-1',
          'ghost',
          'staff-user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException (409) when already reviewed', async () => {
      const findByIdSelfRegistration = jest
        .fn()
        .mockResolvedValue({ ...PENDING_RECORD, status: 'approved' });
      const { service } = makeService({ findByIdSelfRegistration });

      await expect(
        service.merge(
          'tenant-1',
          'acme',
          'self-reg-1',
          'existing-patient-1',
          'staff-user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
