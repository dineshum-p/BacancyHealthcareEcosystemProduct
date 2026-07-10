import { UserRegisteredEventHandler } from './user-registered-event.handler';
import { TenantsRepository } from '../../tenants/tenants.repository';
import { TenantStatus } from '../../tenants/tenant-status.enum';
import { NotificationsService } from '../notifications.service';
import { NotificationStatus } from '../notification-status.enum';
import { UnknownTenantForEventError } from '../errors/unknown-tenant-for-event.error';

describe('UserRegisteredEventHandler', () => {
  let tenantsRepository: jest.Mocked<TenantsRepository>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let handler: UserRegisteredEventHandler;

  beforeEach(() => {
    tenantsRepository = {
      findById: jest.fn(),
      findByIdentifier: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;
    notificationsService = {
      createForSchema: jest.fn(),
      findByIdForSchema: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;
    handler = new UserRegisteredEventHandler(
      tenantsRepository,
      notificationsService,
    );
  });

  it('AC4: maps a user.registered event to a welcome-email notification-send call, scoped to the event tenant', async () => {
    tenantsRepository.findById.mockResolvedValue({
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    });
    notificationsService.createForSchema.mockResolvedValue({
      id: 'notif-1',
      channel: 'email',
      to: 'ada@example.com',
      templateId: 'user.registered.welcome',
      status: NotificationStatus.QUEUED,
      providerMessageId: null,
      attempts: 0,
      lastError: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await handler.handle({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'ada@example.com',
      name: 'Ada',
    });

    expect(result.id).toBe('notif-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationsService.createForSchema).toHaveBeenCalledWith(
      'tenant_acme',
      {
        channel: 'email',
        to: 'ada@example.com',
        templateId: 'user.registered.welcome',
        data: {
          userName: 'Ada',
          tenantName: 'Acme Inc',
          email: 'ada@example.com',
        },
      },
    );
  });

  it('falls back to the email as the display name when the event carries no name', async () => {
    tenantsRepository.findById.mockResolvedValue({
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    });
    notificationsService.createForSchema.mockResolvedValue({
      id: 'notif-1',
      channel: 'email',
      to: 'ada@example.com',
      templateId: 'user.registered.welcome',
      status: NotificationStatus.QUEUED,
      providerMessageId: null,
      attempts: 0,
      lastError: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await handler.handle({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'ada@example.com',
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationsService.createForSchema).toHaveBeenCalledWith(
      'tenant_acme',
      expect.objectContaining({
        data: expect.objectContaining({
          userName: 'ada@example.com',
        }) as unknown,
      }),
    );
  });

  it('throws UnknownTenantForEventError when the tenantId does not resolve to a tenant', async () => {
    tenantsRepository.findById.mockResolvedValue(null);

    await expect(
      handler.handle({
        userId: 'user-1',
        tenantId: 'ghost-tenant',
        email: 'ada@example.com',
      }),
    ).rejects.toBeInstanceOf(UnknownTenantForEventError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationsService.createForSchema).not.toHaveBeenCalled();
  });

  it('throws UnknownTenantForEventError when the tenant resolves but is inactive', async () => {
    tenantsRepository.findById.mockResolvedValue({
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.INACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    });

    await expect(
      handler.handle({
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'ada@example.com',
      }),
    ).rejects.toBeInstanceOf(UnknownTenantForEventError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(notificationsService.createForSchema).not.toHaveBeenCalled();
  });
});
