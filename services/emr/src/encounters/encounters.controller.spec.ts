import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { CreateEncounterDto } from './dto/create-encounter.dto';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

function makeRequest(): RequestWithTenant {
  return {
    tenant: {
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    },
  } as unknown as RequestWithTenant;
}

describe('EncountersController', () => {
  let encountersService: jest.Mocked<EncountersService>;
  let controller: EncountersController;

  beforeEach(() => {
    encountersService = {
      create: jest.fn(),
      findByPatient: jest.fn(),
    } as unknown as jest.Mocked<EncountersService>;
    controller = new EncountersController(encountersService);
  });

  describe('create', () => {
    it('delegates to encountersService.create with the resolved tenant, schema, and patientId (AC1)', async () => {
      const request = makeRequest();
      const dto = new CreateEncounterDto();
      dto.soapNote = {
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
      };
      const response = {
        id: 'encounter-1',
        tenantId: 'tenant-1',
        patientId: PATIENT_ID,
        soapNote: dto.soapNote,
        vitals: null,
        allergies: [],
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      };
      encountersService.create.mockResolvedValue(response);

      const result = await controller.create(request, PATIENT_ID, dto);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(encountersService.create).toHaveBeenCalledWith(
        'tenant-1',
        'tenant_acme',
        PATIENT_ID,
        dto,
      );
    });
  });

  describe('findByPatient', () => {
    it('delegates to encountersService.findByPatient with the resolved tenant, schema, and patientId (AC2)', async () => {
      const request = makeRequest();
      const response = [
        {
          id: 'encounter-1',
          tenantId: 'tenant-1',
          patientId: PATIENT_ID,
          soapNote: {
            subjective: 'S',
            objective: 'O',
            assessment: 'A',
            plan: 'P',
          },
          vitals: null,
          allergies: [],
          createdAt: '2026-07-14T00:00:00.000Z',
          updatedAt: '2026-07-14T00:00:00.000Z',
        },
      ];
      encountersService.findByPatient.mockResolvedValue(response);

      const result = await controller.findByPatient(request, PATIENT_ID);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(encountersService.findByPatient).toHaveBeenCalledWith(
        'tenant-1',
        'tenant_acme',
        PATIENT_ID,
      );
    });
  });

  it('throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
    const request = {} as unknown as RequestWithTenant;
    const dto = new CreateEncounterDto();
    dto.soapNote = {
      subjective: 'S',
      objective: 'O',
      assessment: 'A',
      plan: 'P',
    };

    await expect(controller.create(request, PATIENT_ID, dto)).rejects.toThrow();
  });

  it('findByPatient throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
    const request = {} as unknown as RequestWithTenant;

    await expect(
      controller.findByPatient(request, PATIENT_ID),
    ).rejects.toThrow();
  });
});
