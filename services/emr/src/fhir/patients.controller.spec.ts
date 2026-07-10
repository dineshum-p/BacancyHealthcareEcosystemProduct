import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { CreatePatientDto } from './dto/create-patient.dto';

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

describe('PatientsController', () => {
  let patientsService: jest.Mocked<PatientsService>;
  let controller: PatientsController;

  beforeEach(() => {
    patientsService = {
      createForSchema: jest.fn(),
      findByIdForSchema: jest.fn(),
    } as unknown as jest.Mocked<PatientsService>;
    controller = new PatientsController(patientsService);
  });

  describe('create', () => {
    it('delegates to patientsService.createForSchema with the resolved tenant schema (AC2)', async () => {
      const request = makeRequest();
      const dto = new CreatePatientDto();
      dto.resourceType = 'Patient';
      dto.name = [{ family: 'Shepard' }];
      const response = {
        resourceType: 'Patient' as const,
        id: 'patient-1',
        name: [{ family: 'Shepard' }],
      };
      patientsService.createForSchema.mockResolvedValue(response);

      const result = await controller.create(request, dto);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(patientsService.createForSchema).toHaveBeenCalledWith(
        'tenant_acme',
        dto,
      );
    });
  });

  describe('findOne', () => {
    it('delegates to patientsService.findByIdForSchema with the resolved tenant schema (AC1)', async () => {
      const request = makeRequest();
      const response = {
        resourceType: 'Patient' as const,
        id: 'patient-1',
        name: [{ family: 'Shepard' }],
      };
      patientsService.findByIdForSchema.mockResolvedValue(response);

      const result = await controller.findOne(request, 'patient-1');

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(patientsService.findByIdForSchema).toHaveBeenCalledWith(
        'tenant_acme',
        'patient-1',
      );
    });
  });

  it('throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
    const request = {} as unknown as RequestWithTenant;
    const dto = new CreatePatientDto();
    dto.resourceType = 'Patient';
    dto.name = [{ family: 'Shepard' }];

    await expect(controller.create(request, dto)).rejects.toThrow();
  });
});
