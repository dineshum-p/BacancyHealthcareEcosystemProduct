import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import { EmrSchemaProvisioner } from './emr-schema.provisioner';
import { CreatePatientDto } from './dto/create-patient.dto';

const SCHEMA = 'tenant_a';

function makePatientRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'patient-1',
    resource: {
      resourceType: 'Patient' as const,
      id: 'patient-1',
      name: [{ family: 'Shepard' }],
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PatientsService', () => {
  let repository: jest.Mocked<PatientsRepository>;
  let schemaProvisioner: jest.Mocked<EmrSchemaProvisioner>;
  let service: PatientsService;

  beforeEach(() => {
    repository = {
      insert: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<PatientsRepository>;
    schemaProvisioner = {
      ensurePatientsTable: jest.fn().mockResolvedValue(undefined),
      ensureAuditLogsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmrSchemaProvisioner>;
    service = new PatientsService(repository, schemaProvisioner);
  });

  describe('createForSchema', () => {
    it('AC2: provisions the schema, persists the Patient resource with a server-assigned id, and returns it', async () => {
      const dto = new CreatePatientDto();
      dto.resourceType = 'Patient';
      dto.name = [{ family: 'Shepard', given: ['Jane'] }];
      repository.insert.mockImplementation((schema, id, resource) =>
        Promise.resolve(makePatientRecord({ id, resource })),
      );

      const result = await service.createForSchema(SCHEMA, dto);

      expect(result.resourceType).toBe('Patient');
      expect(result.id).toEqual(expect.any(String));
      expect(result.name).toEqual([{ family: 'Shepard', given: ['Jane'] }]);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensurePatientsTable).toHaveBeenCalledWith(
        SCHEMA,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).toHaveBeenCalledWith(
        SCHEMA,
        expect.any(String),
        expect.objectContaining({ resourceType: 'Patient' }),
      );
    });
  });

  describe('findByIdForSchema', () => {
    it('AC1: returns the FHIR Patient resource for a persisted patient', async () => {
      repository.findById.mockResolvedValue(makePatientRecord());

      const result = await service.findByIdForSchema(SCHEMA, 'patient-1');

      expect(result).toEqual({
        resourceType: 'Patient',
        id: 'patient-1',
        name: [{ family: 'Shepard' }],
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensurePatientsTable).toHaveBeenCalledWith(
        SCHEMA,
      );
    });

    it('throws NotFoundException when no patient matches the id in this schema', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findByIdForSchema(SCHEMA, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
