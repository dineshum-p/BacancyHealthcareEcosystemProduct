import { VisitIntakesController } from './visit-intakes.controller';
import { VisitIntakesService } from './visit-intakes.service';
import { CreateVisitIntakeDto } from './dto/create-visit-intake.dto';
import { VisitIntakeQueryDto } from './dto/visit-intake-query.dto';
import { LinkVisitIntakeDto } from './dto/link-visit-intake.dto';
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

const USER = { userId: 'user-1', tenantId: 't1', role: 'patient' as const };

describe('VisitIntakesController', () => {
  function makeController(overrides?: {
    create?: jest.Mock;
    list?: jest.Mock;
    findById?: jest.Mock;
    link?: jest.Mock;
  }) {
    const create = overrides?.create ?? jest.fn();
    const list = overrides?.list ?? jest.fn();
    const findById = overrides?.findById ?? jest.fn();
    const link = overrides?.link ?? jest.fn();
    const service = {
      create,
      list,
      findById,
      link,
    } as unknown as VisitIntakesService;
    return {
      controller: new VisitIntakesController(service),
      create,
      list,
      findById,
      link,
    };
  }

  describe('create', () => {
    it('delegates to VisitIntakesService.create with the resolved tenant id/schema and user', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'intake-1' });
      const { controller } = makeController({ create });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;
      const dto: CreateVisitIntakeDto = {
        reasonForVisit: 'Reason',
        symptoms: 'Symptoms',
      };

      const result = await controller.create(request, dto);

      expect(create).toHaveBeenCalledWith('t1', 'acme', USER, dto);
      expect(result).toEqual({ id: 'intake-1' });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(
        controller.create(request, {} as CreateVisitIntakeDto),
      ).rejects.toThrow(/TenantGuard/);
    });

    it('throws if request.user was never resolved (AccessTokenGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { tenant: TENANT } as unknown as RequestWithAuth;

      await expect(
        controller.create(request, {} as CreateVisitIntakeDto),
      ).rejects.toThrow(/AccessTokenGuard/);
    });
  });

  describe('list', () => {
    it('delegates to VisitIntakesService.list', async () => {
      const list = jest.fn().mockResolvedValue([]);
      const { controller } = makeController({ list });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;
      const query: VisitIntakeQueryDto = { status: 'pending' };

      const result = await controller.list(request, query);

      expect(list).toHaveBeenCalledWith('t1', 'acme', query);
      expect(result).toEqual([]);
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(controller.list(request, {})).rejects.toThrow(/TenantGuard/);
    });
  });

  describe('findById', () => {
    it('delegates to VisitIntakesService.findById', async () => {
      const findById = jest.fn().mockResolvedValue({ id: 'intake-1' });
      const { controller } = makeController({ findById });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;

      const result = await controller.findById(request, 'intake-1');

      expect(findById).toHaveBeenCalledWith('t1', 'acme', USER, 'intake-1');
      expect(result).toEqual({ id: 'intake-1' });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(controller.findById(request, 'intake-1')).rejects.toThrow(
        /TenantGuard/,
      );
    });

    it('throws if request.user was never resolved (AccessTokenGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { tenant: TENANT } as unknown as RequestWithAuth;

      await expect(controller.findById(request, 'intake-1')).rejects.toThrow(
        /AccessTokenGuard/,
      );
    });
  });

  describe('link', () => {
    it('delegates to VisitIntakesService.link', async () => {
      const link = jest
        .fn()
        .mockResolvedValue({ id: 'intake-1', status: 'linked' });
      const { controller } = makeController({ link });
      const request = {
        tenant: TENANT,
        user: USER,
      } as unknown as RequestWithAuth;
      const dto: LinkVisitIntakeDto = {
        providerId: 'provider-1',
        appointmentId: 'appt-1',
      };

      const result = await controller.link(request, 'intake-1', dto);

      expect(link).toHaveBeenCalledWith('t1', 'acme', 'intake-1', dto);
      expect(result).toEqual({ id: 'intake-1', status: 'linked' });
    });

    it('throws if request.tenant was never resolved (TenantGuard not applied)', async () => {
      const { controller } = makeController();
      const request = { user: USER } as unknown as RequestWithAuth;

      await expect(
        controller.link(request, 'intake-1', {} as LinkVisitIntakeDto),
      ).rejects.toThrow(/TenantGuard/);
    });
  });
});
