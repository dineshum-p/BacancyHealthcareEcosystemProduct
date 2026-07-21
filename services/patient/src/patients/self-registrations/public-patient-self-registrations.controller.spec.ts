import { PublicPatientSelfRegistrationsController } from './public-patient-self-registrations.controller';
import { PatientSelfRegistrationsService } from './patient-self-registrations.service';
import { SelfRegisterPatientDto } from './dto/self-register-patient.dto';
import { RequestWithTenant } from '../../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../../tenants/tenant-status.enum';

const TENANT = {
  id: 't1',
  slug: 'acme',
  status: TenantStatus.ACTIVE,
  schemaName: 'acme',
  name: 'Acme',
  plan: 'starter',
  ownerEmail: null,
};

describe('PublicPatientSelfRegistrationsController', () => {
  function makeController(overrides?: { register?: jest.Mock }) {
    const register = overrides?.register ?? jest.fn();
    const service = { register } as unknown as PatientSelfRegistrationsService;
    return {
      controller: new PublicPatientSelfRegistrationsController(service),
      register,
    };
  }

  describe('register', () => {
    it('delegates to PatientSelfRegistrationsService.register with the resolved tenant id/schema', async () => {
      const register = jest
        .fn()
        .mockResolvedValue({ id: 'reg-1', tenantId: 't1', status: 'pending' });
      const { controller } = makeController({ register });
      const request = { tenant: TENANT } as unknown as RequestWithTenant;
      const dto: SelfRegisterPatientDto = {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      };

      const result = await controller.register(request, dto);

      expect(register).toHaveBeenCalledWith('t1', 'acme', dto);
      expect(result).toEqual({
        id: 'reg-1',
        tenantId: 't1',
        status: 'pending',
      });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = {} as RequestWithTenant;

      await expect(
        controller.register(request, {} as SelfRegisterPatientDto),
      ).rejects.toThrow(/TenantGuard/);
    });
  });
});
