import { ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { PatientProfileService } from './patient-profile.service';
import { PatientProfileRepository } from './patient-profile.repository';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { PatientsRepository } from '../fhir/patients.repository';
import { PatientRecord } from '../fhir/patient.entity';
import { PatientProfileRecord } from './patient-profile.entity';
import { UpsertPatientProfileDto } from './dto/upsert-patient-profile.dto';

const TENANT_ID = 'tenant-1';
const SCHEMA = 'tenant_a';
const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

function user(
  role: AccessTokenPayload['role'],
  userId = 'staff-1',
): AccessTokenPayload {
  return { userId, tenantId: TENANT_ID, role };
}

function makeDto(overrides: Partial<UpsertPatientProfileDto> = {}) {
  const dto = new UpsertPatientProfileDto();
  dto.allergies = [];
  dto.chronicConditions = [];
  dto.medications = [];
  Object.assign(dto, overrides);
  return dto;
}

function makeProfileRecord(
  overrides: Partial<PatientProfileRecord> = {},
): PatientProfileRecord {
  return {
    id: 'profile-1',
    patientId: PATIENT_ID,
    allergies: [{ substance: 'Penicillin' }],
    chronicConditions: [{ name: 'Asthma' }],
    medications: [{ name: 'Albuterol' }],
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    ...overrides,
  };
}

function makePatientRecord(
  overrides: Partial<PatientRecord> = {},
): PatientRecord {
  return {
    id: PATIENT_ID,
    resource: {
      resourceType: 'Patient',
      id: PATIENT_ID,
      name: [{ family: 'Doe', given: ['Jane'] }],
      birthDate: '1990-01-01',
    },
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PatientProfileService', () => {
  let repository: jest.Mocked<PatientProfileRepository>;
  let schemaProvisioner: jest.Mocked<EmrSchemaProvisioner>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let service: PatientProfileService;

  beforeEach(() => {
    repository = {
      findByPatientId: jest.fn(),
      upsert: jest.fn(),
    } as unknown as jest.Mocked<PatientProfileRepository>;
    schemaProvisioner = {
      ensurePatientProfilesTable: jest.fn().mockResolvedValue(undefined),
      ensurePatientsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmrSchemaProvisioner>;
    patientsRepository = {
      findById: jest.fn().mockResolvedValue(makePatientRecord()),
    } as unknown as jest.Mocked<PatientsRepository>;
    service = new PatientProfileService(
      repository,
      schemaProvisioner,
      patientsRepository,
    );
  });

  describe('self-scoping (BAC-41 assertPatientScope)', () => {
    it('allows a patient to GET their OWN profile', async () => {
      repository.findByPatientId.mockResolvedValue(null);

      await expect(
        service.getProfile(
          TENANT_ID,
          SCHEMA,
          PATIENT_ID,
          user('patient', PATIENT_ID),
        ),
      ).resolves.toBeDefined();
    });

    it("forbids a patient from GETting a DIFFERENT patient's profile", async () => {
      await expect(
        service.getProfile(
          TENANT_ID,
          SCHEMA,
          PATIENT_ID,
          user('patient', 'some-other-patient'),
        ),
      ).rejects.toThrow(ForbiddenException);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.findByPatientId).not.toHaveBeenCalled();
    });

    it('allows a patient to PUT their OWN profile', async () => {
      repository.upsert.mockResolvedValue(makeProfileRecord());

      await expect(
        service.upsertProfile(
          TENANT_ID,
          SCHEMA,
          PATIENT_ID,
          user('patient', PATIENT_ID),
          makeDto(),
        ),
      ).resolves.toBeDefined();
    });

    it("forbids a patient from PUTting a DIFFERENT patient's profile", async () => {
      await expect(
        service.upsertProfile(
          TENANT_ID,
          SCHEMA,
          PATIENT_ID,
          user('patient', 'some-other-patient'),
          makeDto(),
        ),
      ).rejects.toThrow(ForbiddenException);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('staff visibility (BAC-44: staff-side roles may touch ANY patient)', () => {
    it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
      "%s can GET any patient's profile",
      async (role) => {
        repository.findByPatientId.mockResolvedValue(makeProfileRecord());

        await expect(
          service.getProfile(TENANT_ID, SCHEMA, PATIENT_ID, user(role)),
        ).resolves.toBeDefined();
      },
    );

    it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
      "%s can PUT any patient's profile",
      async (role) => {
        repository.upsert.mockResolvedValue(makeProfileRecord());

        await expect(
          service.upsertProfile(
            TENANT_ID,
            SCHEMA,
            PATIENT_ID,
            user(role),
            makeDto(),
          ),
        ).resolves.toBeDefined();
      },
    );
  });

  describe('getProfile', () => {
    it('returns hasProfile: false with empty arrays and null timestamps when no profile has ever been saved', async () => {
      repository.findByPatientId.mockResolvedValue(null);

      const result = await service.getProfile(
        TENANT_ID,
        SCHEMA,
        PATIENT_ID,
        user('staff'),
      );

      expect(result).toEqual({
        id: null,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        hasProfile: false,
        demographics: {
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
        },
        allergies: [],
        chronicConditions: [],
        medications: [],
        createdAt: null,
        updatedAt: null,
      });
    });

    it('returns hasProfile: true with the saved profile fields when one exists', async () => {
      repository.findByPatientId.mockResolvedValue(makeProfileRecord());

      const result = await service.getProfile(
        TENANT_ID,
        SCHEMA,
        PATIENT_ID,
        user('staff'),
      );

      expect(result.hasProfile).toBe(true);
      expect(result.id).toBe('profile-1');
      expect(result.allergies).toEqual([{ substance: 'Penicillin' }]);
      expect(result.chronicConditions).toEqual([{ name: 'Asthma' }]);
      expect(result.medications).toEqual([{ name: 'Albuterol' }]);
      expect(result.createdAt).toBe('2026-07-14T00:00:00.000Z');
      expect(result.updatedAt).toBe('2026-07-14T00:00:00.000Z');
    });

    it('demographics fields are all null when no FHIR Patient resource exists for this id (documented limitation)', async () => {
      patientsRepository.findById.mockResolvedValue(null);
      repository.findByPatientId.mockResolvedValue(null);

      const result = await service.getProfile(
        TENANT_ID,
        SCHEMA,
        PATIENT_ID,
        user('staff'),
      );

      expect(result.demographics).toEqual({
        firstName: null,
        lastName: null,
        dateOfBirth: null,
      });
    });

    it('provisions the patient_profiles and patients tables before querying', async () => {
      repository.findByPatientId.mockResolvedValue(null);

      await service.getProfile(TENANT_ID, SCHEMA, PATIENT_ID, user('staff'));

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensurePatientProfilesTable).toHaveBeenCalledWith(
        SCHEMA,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensurePatientsTable).toHaveBeenCalledWith(
        SCHEMA,
      );
    });
  });

  describe('upsertProfile', () => {
    it('passes the dto fields through to the repository and returns hasProfile: true', async () => {
      const dto = makeDto({
        allergies: [{ substance: 'Penicillin' }],
        chronicConditions: [{ name: 'Asthma' }],
        medications: [{ name: 'Albuterol' }],
      });
      repository.upsert.mockResolvedValue(makeProfileRecord());

      const result = await service.upsertProfile(
        TENANT_ID,
        SCHEMA,
        PATIENT_ID,
        user('provider'),
        dto,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.upsert).toHaveBeenCalledWith(SCHEMA, PATIENT_ID, {
        allergies: dto.allergies,
        chronicConditions: dto.chronicConditions,
        medications: dto.medications,
      });
      expect(result.hasProfile).toBe(true);
      expect(result.tenantId).toBe(TENANT_ID);
    });
  });
});
