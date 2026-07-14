import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-search-query.dto';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';

const TENANT = {
  id: 't1',
  slug: 'acme',
  status: TenantStatus.ACTIVE,
  schemaName: 'acme',
  name: 'Acme',
  plan: 'starter',
  ownerEmail: null,
};

describe('PatientsController', () => {
  function makeController(overrides?: {
    create?: jest.Mock;
    search?: jest.Mock;
  }) {
    const create = overrides?.create ?? jest.fn();
    const search = overrides?.search ?? jest.fn();
    const service = { create, search } as unknown as PatientsService;
    return { controller: new PatientsController(service), create, search };
  }

  describe('create', () => {
    it('delegates to PatientsService.create with the resolved tenant id/schema', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: 'patient-1', mrn: 'MRN-000001' });
      const { controller } = makeController({ create });
      const request = { tenant: TENANT } as unknown as RequestWithTenant;
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      };

      const result = await controller.create(request, dto);

      expect(create).toHaveBeenCalledWith('t1', 'acme', dto);
      expect(result).toEqual({ id: 'patient-1', mrn: 'MRN-000001' });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = {} as RequestWithTenant;

      await expect(
        controller.create(request, {} as CreatePatientDto),
      ).rejects.toThrow(/TenantGuard/);
    });
  });

  describe('search', () => {
    it('delegates to PatientsService.search with the resolved tenant id/schema', async () => {
      const search = jest
        .fn()
        .mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
      const { controller } = makeController({ search });
      const request = { tenant: TENANT } as unknown as RequestWithTenant;
      const query = { name: 'Doe' };

      const result = await controller.search(request, query);

      expect(search).toHaveBeenCalledWith('t1', 'acme', query);
      expect(result).toEqual({ items: [], page: 1, limit: 20, total: 0 });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = {} as RequestWithTenant;
      const query: PatientSearchQueryDto = {};

      await expect(controller.search(request, query)).rejects.toThrow(
        /TenantGuard/,
      );
    });
  });
});
