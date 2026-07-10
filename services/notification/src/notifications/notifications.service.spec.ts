import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsSchemaProvisioner } from './notifications-schema.provisioner';
import { NotificationDeliveryWorker } from './delivery/notification-delivery.worker';
import { NotificationStatus } from './notification-status.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';

const SCHEMA = 'tenant_a';

function makeNotificationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notif-1',
    channel: 'email' as const,
    to: 'a@example.com',
    templateId: 'generic.notice',
    data: { message: 'hi' },
    status: NotificationStatus.QUEUED,
    providerMessageId: null,
    attempts: 0,
    lastError: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let repository: jest.Mocked<NotificationsRepository>;
  let schemaProvisioner: jest.Mocked<NotificationsSchemaProvisioner>;
  let deliveryWorker: jest.Mocked<NotificationDeliveryWorker>;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      insertQueued: jest.fn(),
      findById: jest.fn(),
      markSent: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<NotificationsRepository>;
    schemaProvisioner = {
      ensureProvisioned: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsSchemaProvisioner>;
    deliveryWorker = {
      deliver: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationDeliveryWorker>;
    service = new NotificationsService(
      repository,
      schemaProvisioner,
      deliveryWorker,
    );
  });

  describe('createForSchema', () => {
    it('AC1: provisions the schema, persists a queued notification, and returns it immediately', async () => {
      const dto: CreateNotificationDto = {
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: { message: 'hi' },
      };
      repository.insertQueued.mockResolvedValue(makeNotificationRow());

      const result = await service.createForSchema(SCHEMA, dto);

      expect(result).toMatchObject({
        id: 'notif-1',
        status: NotificationStatus.QUEUED,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(SCHEMA);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insertQueued).toHaveBeenCalledWith(SCHEMA, {
        id: expect.any(String) as string,
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: { message: 'hi' },
      });
    });

    it('AC1/AC3: schedules delivery (fire-and-forget) without waiting for it', async () => {
      const dto: CreateNotificationDto = {
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
      };
      repository.insertQueued.mockResolvedValue(makeNotificationRow());
      let resolveDeliver!: () => void;
      deliveryWorker.deliver.mockReturnValue(
        new Promise((resolve) => {
          resolveDeliver = resolve;
        }),
      );

      const result = await service.createForSchema(SCHEMA, dto);

      // The call resolved even though deliver() has NOT resolved yet.
      expect(result.status).toBe(NotificationStatus.QUEUED);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(deliveryWorker.deliver).toHaveBeenCalledWith(
        SCHEMA,
        expect.objectContaining({ channel: 'email', to: 'a@example.com' }),
        expect.objectContaining({ body: expect.any(String) as string }),
      );
      resolveDeliver();
    });

    it('defaults data to an empty object when not supplied', async () => {
      const dto: CreateNotificationDto = {
        channel: 'sms',
        to: '+15551234567',
        templateId: 'generic.notice',
      };
      repository.insertQueued.mockResolvedValue(makeNotificationRow());

      await service.createForSchema(SCHEMA, dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insertQueued).toHaveBeenCalledWith(
        SCHEMA,
        expect.objectContaining({ data: {} }),
      );
    });

    it('rejects an unknown templateId with BadRequestException before persisting anything', async () => {
      const dto: CreateNotificationDto = {
        channel: 'email',
        to: 'a@example.com',
        templateId: 'does.not.exist',
      };

      await expect(service.createForSchema(SCHEMA, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insertQueued).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureProvisioned).not.toHaveBeenCalled();
    });
  });

  describe('findByIdForSchema', () => {
    it('AC2: returns the current status/attempts/providerMessageId of a persisted notification', async () => {
      repository.findById.mockResolvedValue(
        makeNotificationRow({
          status: NotificationStatus.SENT,
          providerMessageId: 'provider-msg-1',
          attempts: 2,
        }),
      );

      const result = await service.findByIdForSchema(SCHEMA, 'notif-1');

      expect(result).toMatchObject({
        id: 'notif-1',
        status: NotificationStatus.SENT,
        providerMessageId: 'provider-msg-1',
        attempts: 2,
      });
      // A schema with zero notifications yet has no `notifications` table
      // at all (lazy provisioning) -- ensure a lookup provisions it first
      // so it 404s rather than 500s.
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureProvisioned).toHaveBeenCalledWith(SCHEMA);
    });

    it('throws NotFoundException when no notification matches the id in this schema', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findByIdForSchema(SCHEMA, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
