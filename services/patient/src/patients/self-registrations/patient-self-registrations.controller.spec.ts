import { PatientSelfRegistrationsController } from './patient-self-registrations.controller';
import { PatientSelfRegistrationsService } from './patient-self-registrations.service';
import { RejectSelfRegistrationDto } from './dto/reject-self-registration.dto';
import { MergeSelfRegistrationDto } from './dto/merge-self-registration.dto';
import { RequestWithAuth } from '../../auth/request-with-auth.interface';
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

describe('PatientSelfRegistrationsController', () => {
  function makeController(overrides?: {
    list?: jest.Mock;
    approve?: jest.Mock;
    reject?: jest.Mock;
    merge?: jest.Mock;
  }) {
    const list = overrides?.list ?? jest.fn();
    const approve = overrides?.approve ?? jest.fn();
    const reject = overrides?.reject ?? jest.fn();
    const merge = overrides?.merge ?? jest.fn();
    const service = {
      list,
      approve,
      reject,
      merge,
    } as unknown as PatientSelfRegistrationsService;
    return {
      controller: new PatientSelfRegistrationsController(service),
      list,
      approve,
      reject,
      merge,
    };
  }

  describe('list', () => {
    it('delegates to the service with the resolved tenant and status filter', async () => {
      const list = jest.fn().mockResolvedValue([]);
      const { controller } = makeController({ list });
      const request = {
        tenant: TENANT,
        user: { userId: 'staff-1', tenantId: 't1', role: 'staff' },
      } as unknown as RequestWithAuth;

      const result = await controller.list(request, { status: 'pending' });

      expect(list).toHaveBeenCalledWith('t1', 'acme', 'pending');
      expect(result).toEqual([]);
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = {} as RequestWithAuth;

      await expect(controller.list(request, {})).rejects.toThrow(/TenantGuard/);
    });
  });

  describe('approve', () => {
    it('delegates to the service with the resolved tenant and actor userId', async () => {
      const approve = jest.fn().mockResolvedValue({ status: 'approved' });
      const { controller } = makeController({ approve });
      const request = {
        tenant: TENANT,
        user: { userId: 'staff-1', tenantId: 't1', role: 'clinic_admin' },
      } as unknown as RequestWithAuth;

      const result = await controller.approve(request, 'self-reg-1');

      expect(approve).toHaveBeenCalledWith(
        't1',
        'acme',
        'self-reg-1',
        'staff-1',
      );
      expect(result).toEqual({ status: 'approved' });
    });

    it('passes null as the actor userId when request.user is not set', async () => {
      const approve = jest.fn().mockResolvedValue({ status: 'approved' });
      const { controller } = makeController({ approve });
      const request = { tenant: TENANT } as unknown as RequestWithAuth;

      await controller.approve(request, 'self-reg-1');

      expect(approve).toHaveBeenCalledWith('t1', 'acme', 'self-reg-1', null);
    });
  });

  describe('reject', () => {
    it('delegates to the service with the resolved tenant, reason, and actor userId', async () => {
      const reject = jest.fn().mockResolvedValue({ status: 'rejected' });
      const { controller } = makeController({ reject });
      const request = {
        tenant: TENANT,
        user: { userId: 'staff-1', tenantId: 't1', role: 'staff' },
      } as unknown as RequestWithAuth;
      const dto: RejectSelfRegistrationDto = { reason: 'Not legitimate.' };

      const result = await controller.reject(request, 'self-reg-1', dto);

      expect(reject).toHaveBeenCalledWith(
        't1',
        'acme',
        'self-reg-1',
        'Not legitimate.',
        'staff-1',
      );
      expect(result).toEqual({ status: 'rejected' });
    });
  });

  describe('merge', () => {
    it('delegates to the service with the resolved tenant, target patient, and actor userId', async () => {
      const merge = jest.fn().mockResolvedValue({ status: 'merged' });
      const { controller } = makeController({ merge });
      const request = {
        tenant: TENANT,
        user: { userId: 'staff-1', tenantId: 't1', role: 'clinic_admin' },
      } as unknown as RequestWithAuth;
      const dto: MergeSelfRegistrationDto = {
        targetPatientId: 'existing-patient-1',
      };

      const result = await controller.merge(request, 'self-reg-1', dto);

      expect(merge).toHaveBeenCalledWith(
        't1',
        'acme',
        'self-reg-1',
        'existing-patient-1',
        'staff-1',
      );
      expect(result).toEqual({ status: 'merged' });
    });
  });
});
