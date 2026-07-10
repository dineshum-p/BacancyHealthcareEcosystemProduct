import { ForbiddenException } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RecordUsageEventDto } from './dto/record-usage-event.dto';
import { UsageQueryDto } from './dto/usage-query.dto';

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

describe('UsageController', () => {
  let usageService: jest.Mocked<UsageService>;
  let controller: UsageController;

  beforeEach(() => {
    usageService = {
      recordEvent: jest.fn(),
      getUsageSummary: jest.fn(),
    } as unknown as jest.Mocked<UsageService>;
    controller = new UsageController(usageService);
  });

  describe('recordEvent', () => {
    it('delegates to usageService.recordEvent with the resolved tenant schema (AC1), matching by tenant id', async () => {
      const request = makeRequest();
      const dto = new RecordUsageEventDto();
      dto.eventId = 'evt-1';
      dto.tenantId = 'tenant-1';
      dto.metric = 'patient.created';
      dto.quantity = 1;
      dto.occurredAt = '2026-07-01T00:00:00.000Z';
      const response = {
        id: 'record-1',
        eventId: 'evt-1',
        tenantId: 'tenant-1',
        metric: 'patient.created' as const,
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
        recordedAt: '2026-07-01T00:05:00.000Z',
      };
      usageService.recordEvent.mockResolvedValue(response);

      const result = await controller.recordEvent(request, dto);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usageService.recordEvent).toHaveBeenCalledWith('tenant_acme', dto);
    });

    it('also matches when the dto.tenantId is the tenant SLUG rather than its id', async () => {
      const request = makeRequest();
      const dto = new RecordUsageEventDto();
      dto.eventId = 'evt-1';
      dto.tenantId = 'acme';
      dto.metric = 'patient.created';
      dto.quantity = 1;
      dto.occurredAt = '2026-07-01T00:00:00.000Z';
      usageService.recordEvent.mockResolvedValue({
        id: 'record-1',
        eventId: 'evt-1',
        tenantId: 'acme',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
        recordedAt: '2026-07-01T00:05:00.000Z',
      });

      await expect(controller.recordEvent(request, dto)).resolves.toBeDefined();
    });

    it('rejects with 403 when dto.tenantId does not match the resolved tenant (cross-tenant write)', async () => {
      const request = makeRequest();
      const dto = new RecordUsageEventDto();
      dto.eventId = 'evt-1';
      dto.tenantId = 'a-different-tenant';
      dto.metric = 'patient.created';
      dto.quantity = 1;
      dto.occurredAt = '2026-07-01T00:00:00.000Z';

      await expect(controller.recordEvent(request, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usageService.recordEvent).not.toHaveBeenCalled();
    });

    it('throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
      const request = {} as unknown as RequestWithTenant;
      const dto = new RecordUsageEventDto();
      dto.eventId = 'evt-1';
      dto.tenantId = 'tenant-1';
      dto.metric = 'patient.created';
      dto.quantity = 1;
      dto.occurredAt = '2026-07-01T00:00:00.000Z';

      await expect(controller.recordEvent(request, dto)).rejects.toThrow();
    });
  });

  describe('getUsageSummary', () => {
    it('delegates to usageService.getUsageSummary with the resolved tenant schema/plan (AC2/AC4)', async () => {
      const request = makeRequest();
      const query = new UsageQueryDto();
      query.tenantId = 'tenant-1';
      query.period = '2026-07';
      const response = {
        tenantId: 'tenant-1',
        period: '2026-07',
        metrics: [],
      };
      usageService.getUsageSummary.mockResolvedValue(response);

      const result = await controller.getUsageSummary(request, query);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usageService.getUsageSummary).toHaveBeenCalledWith(
        'tenant_acme',
        'tenant-1',
        'starter',
        '2026-07',
      );
    });

    it('rejects with 403 when query.tenantId does not match the resolved tenant (cross-tenant read)', async () => {
      const request = makeRequest();
      const query = new UsageQueryDto();
      query.tenantId = 'a-different-tenant';
      query.period = '2026-07';

      await expect(
        controller.getUsageSummary(request, query),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(usageService.getUsageSummary).not.toHaveBeenCalled();
    });

    it('throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
      const request = {} as unknown as RequestWithTenant;
      const query = new UsageQueryDto();
      query.tenantId = 'tenant-1';
      query.period = '2026-07';

      await expect(
        controller.getUsageSummary(request, query),
      ).rejects.toThrow();
    });
  });
});
