import { NotFoundException } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { EncountersRepository } from './encounters.repository';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { DomainEventPublisher } from '../events/domain-event-publisher.interface';
import { PatientsRepository } from '../fhir/patients.repository';
import { PatientRecord } from '../fhir/patient.entity';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { EncounterRecord } from './encounter.entity';

const SCHEMA = 'tenant_a';
const TENANT_ID = 'tenant-1';
const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

function makePatientRecord(
  overrides: Partial<PatientRecord> = {},
): PatientRecord {
  return {
    id: PATIENT_ID,
    resource: { resourceType: 'Patient', id: PATIENT_ID },
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<EncounterRecord> = {}): EncounterRecord {
  return {
    id: 'encounter-1',
    patientId: PATIENT_ID,
    subjective: 'S',
    objective: 'O',
    assessment: 'A',
    plan: 'P',
    heartRate: null,
    bloodPressureSystolic: null,
    bloodPressureDiastolic: null,
    temperature: null,
    respiratoryRate: null,
    spO2: null,
    allergies: [],
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    ...overrides,
  };
}

function makeDto(
  overrides: Partial<CreateEncounterDto> = {},
): CreateEncounterDto {
  const dto = new CreateEncounterDto();
  dto.soapNote = {
    subjective: 'S',
    objective: 'O',
    assessment: 'A',
    plan: 'P',
  };
  Object.assign(dto, overrides);
  return dto;
}

describe('EncountersService', () => {
  let repository: jest.Mocked<EncountersRepository>;
  let schemaProvisioner: jest.Mocked<EmrSchemaProvisioner>;
  let eventPublisher: jest.Mocked<DomainEventPublisher>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let service: EncountersService;

  beforeEach(() => {
    repository = {
      insert: jest.fn(),
      findByPatientId: jest.fn(),
    } as unknown as jest.Mocked<EncountersRepository>;
    schemaProvisioner = {
      ensureEncountersTable: jest.fn().mockResolvedValue(undefined),
      ensurePatientsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmrSchemaProvisioner>;
    eventPublisher = {
      publishEncounterCreated: jest.fn().mockResolvedValue(undefined),
    };
    patientsRepository = {
      findById: jest.fn().mockResolvedValue(makePatientRecord()),
    } as unknown as jest.Mocked<PatientsRepository>;
    service = new EncountersService(
      repository,
      schemaProvisioner,
      eventPublisher,
      patientsRepository,
    );
  });

  describe('create', () => {
    it('AC1: provisions the schema, persists the SOAP note/vitals/allergies, and returns the created encounter', async () => {
      const dto = makeDto({
        vitals: { heartRate: 80 },
        allergies: [{ substance: 'Penicillin' }],
      });
      repository.insert.mockResolvedValue(
        makeRecord({ heartRate: 80, allergies: [{ substance: 'Penicillin' }] }),
      );

      const result = await service.create(TENANT_ID, SCHEMA, PATIENT_ID, dto);

      expect(result.id).toBe('encounter-1');
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.patientId).toBe(PATIENT_ID);
      expect(result.soapNote).toEqual({
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
      });
      expect(result.vitals).toEqual({ heartRate: 80 });
      expect(result.allergies).toEqual([{ substance: 'Penicillin' }]);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureEncountersTable).toHaveBeenCalledWith(
        SCHEMA,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).toHaveBeenCalledWith(SCHEMA, PATIENT_ID, {
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        heartRate: 80,
        bloodPressureSystolic: undefined,
        bloodPressureDiastolic: undefined,
        temperature: undefined,
        respiratoryRate: undefined,
        spO2: undefined,
        allergies: [{ substance: 'Penicillin' }],
      });
    });

    it('returns null vitals when none of the optional vitals were captured', async () => {
      const dto = makeDto();
      repository.insert.mockResolvedValue(makeRecord());

      const result = await service.create(TENANT_ID, SCHEMA, PATIENT_ID, dto);

      expect(result.vitals).toBeNull();
      expect(result.allergies).toEqual([]);
    });

    it('includes every captured vital field in the returned vitals object', async () => {
      const dto = makeDto();
      repository.insert.mockResolvedValue(
        makeRecord({
          heartRate: 80,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          temperature: 37,
          respiratoryRate: 16,
          spO2: 98,
        }),
      );

      const result = await service.create(TENANT_ID, SCHEMA, PATIENT_ID, dto);

      expect(result.vitals).toEqual({
        heartRate: 80,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        temperature: 37,
        respiratoryRate: 16,
        spO2: 98,
      });
    });

    it('AC4: publishes encounter.created with a stable eventId (the encounter id) after persisting', async () => {
      const dto = makeDto();
      repository.insert.mockResolvedValue(makeRecord());

      const result = await service.create(TENANT_ID, SCHEMA, PATIENT_ID, dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(eventPublisher.publishEncounterCreated).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(eventPublisher.publishEncounterCreated).toHaveBeenCalledWith({
        eventId: result.id,
        encounterId: result.id,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        createdAt: result.createdAt,
      });
    });

    it('404s (NotFoundException) for a well-formed but nonexistent patientId, without persisting an encounter or publishing an event', async () => {
      const dto = makeDto();
      patientsRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, SCHEMA, PATIENT_ID, dto),
      ).rejects.toThrow(NotFoundException);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(eventPublisher.publishEncounterCreated).not.toHaveBeenCalled();
    });

    it('looks up the patient in the SAME schema (same-service check) before persisting', async () => {
      const dto = makeDto();
      repository.insert.mockResolvedValue(makeRecord());

      await service.create(TENANT_ID, SCHEMA, PATIENT_ID, dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensurePatientsTable).toHaveBeenCalledWith(
        SCHEMA,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(patientsRepository.findById).toHaveBeenCalledWith(
        SCHEMA,
        PATIENT_ID,
      );
    });
  });

  describe('findByPatient', () => {
    it('AC2: returns the patient encounter history, most recent first, as returned by the repository', async () => {
      const first = makeRecord({ id: 'e1' });
      const second = makeRecord({ id: 'e2' });
      repository.findByPatientId.mockResolvedValue([second, first]);

      const result = await service.findByPatient(TENANT_ID, SCHEMA, PATIENT_ID);

      expect(result.map((r) => r.id)).toEqual(['e2', 'e1']);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureEncountersTable).toHaveBeenCalledWith(
        SCHEMA,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.findByPatientId).toHaveBeenCalledWith(
        SCHEMA,
        PATIENT_ID,
      );
    });
  });
});
