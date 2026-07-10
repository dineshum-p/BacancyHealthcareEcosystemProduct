import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationStatus } from './notification-status.enum';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';

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

describe('NotificationsController', () => {
  let notificationsService: jest.Mocked<NotificationsService>;
  let controller: NotificationsController;

  beforeEach(() => {
    notificationsService = {
      createForSchema: jest.fn(),
      findByIdForSchema: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;
    controller = new NotificationsController(notificationsService);
  });

  describe('create', () => {
    it('delegates to notificationsService.createForSchema with the resolved tenant schema', async () => {
      const request = makeRequest();
      const dto = {
        channel: 'email' as const,
        to: 'a@example.com',
        templateId: 'generic.notice',
      };
      const response = {
        id: 'notif-1',
        channel: 'email' as const,
        to: 'a@example.com',
        templateId: 'generic.notice',
        status: NotificationStatus.QUEUED,
        providerMessageId: null,
        attempts: 0,
        lastError: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      notificationsService.createForSchema.mockResolvedValue(response);

      const result = await controller.create(request, dto);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(notificationsService.createForSchema).toHaveBeenCalledWith(
        'tenant_acme',
        dto,
      );
    });
  });

  describe('findOne', () => {
    it('delegates to notificationsService.findByIdForSchema with the resolved tenant schema', async () => {
      const request = makeRequest();
      const response = {
        id: 'notif-1',
        channel: 'email' as const,
        to: 'a@example.com',
        templateId: 'generic.notice',
        status: NotificationStatus.SENT,
        providerMessageId: 'provider-msg-1',
        attempts: 1,
        lastError: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      notificationsService.findByIdForSchema.mockResolvedValue(response);

      const result = await controller.findOne(request, 'notif-1');

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(notificationsService.findByIdForSchema).toHaveBeenCalledWith(
        'tenant_acme',
        'notif-1',
      );
    });
  });
});
