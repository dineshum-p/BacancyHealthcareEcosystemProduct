import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RequestWithAuth } from '../auth/request-with-auth.interface';
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

const USER = { userId: 'user-1', tenantId: 't1', role: 'staff' as const };

describe('AppointmentsController', () => {
  function makeController(overrides?: {
    create?: jest.Mock;
    findDaySchedule?: jest.Mock;
    update?: jest.Mock;
  }) {
    const create = overrides?.create ?? jest.fn();
    const findDaySchedule = overrides?.findDaySchedule ?? jest.fn();
    const update = overrides?.update ?? jest.fn();
    const service = {
      create,
      findDaySchedule,
      update,
    } as unknown as AppointmentsService;
    return {
      controller: new AppointmentsController(service),
      create,
      findDaySchedule,
      update,
    };
  }

  describe('create', () => {
    it('delegates to AppointmentsService.create with the resolved tenant id/schema and user', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'appt-1' });
      const { controller } = makeController({ create });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;
      const dto = {
        providerId: 'provider-1',
        patientId: 'patient-1',
        startTime: '2026-07-20T09:00:00.000Z',
        endTime: '2026-07-20T09:30:00.000Z',
        notifyChannel: 'email' as const,
        notifyTo: 'patient@example.com',
      };

      const result = await controller.create(request, dto);

      expect(create).toHaveBeenCalledWith('t1', 'acme', USER, dto);
      expect(result).toEqual({ id: 'appt-1' });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(
        controller.create(request, {} as CreateAppointmentDto),
      ).rejects.toThrow(/TenantGuard/);
    });

    it('throws if request.user was never resolved (AccessTokenGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { tenant: TENANT } as unknown as RequestWithAuth;

      await expect(
        controller.create(request, {} as CreateAppointmentDto),
      ).rejects.toThrow(/AccessTokenGuard/);
    });
  });

  describe('findDaySchedule', () => {
    it('delegates to AppointmentsService.findDaySchedule', async () => {
      const findDaySchedule = jest.fn().mockResolvedValue([]);
      const { controller } = makeController({ findDaySchedule });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;
      const query: AppointmentQueryDto = { date: '2026-07-20' };

      const result = await controller.findDaySchedule(request, query);

      expect(findDaySchedule).toHaveBeenCalledWith('t1', 'acme', USER, query);
      expect(result).toEqual([]);
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(
        controller.findDaySchedule(request, { date: '2026-07-20' }),
      ).rejects.toThrow(/TenantGuard/);
    });
  });

  describe('update', () => {
    it('delegates to AppointmentsService.update', async () => {
      const update = jest
        .fn()
        .mockResolvedValue({ id: 'appt-1', status: 'cancelled' });
      const { controller } = makeController({ update });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;
      const dto: UpdateAppointmentDto = { action: 'cancel' };

      const result = await controller.update(request, 'appt-1', dto);

      expect(update).toHaveBeenCalledWith('t1', 'acme', USER, 'appt-1', dto);
      expect(result).toEqual({ id: 'appt-1', status: 'cancelled' });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(
        controller.update(request, 'appt-1', { action: 'cancel' }),
      ).rejects.toThrow(/TenantGuard/);
    });

    it('throws if request.user was never resolved (AccessTokenGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { tenant: TENANT } as unknown as RequestWithAuth;

      await expect(
        controller.update(request, 'appt-1', { action: 'cancel' }),
      ).rejects.toThrow(/AccessTokenGuard/);
    });
  });
});
