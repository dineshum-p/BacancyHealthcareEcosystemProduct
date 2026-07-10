import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NotificationResponse } from '@hep/shared-types';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsSchemaProvisioner } from './notifications-schema.provisioner';
import { NotificationDeliveryWorker } from './delivery/notification-delivery.worker';
import { getTemplate } from './templates/template-registry';
import { UnknownTemplateError } from './errors/unknown-template.error';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { toNotificationResponseDto } from './dto/notification-response.dto';

/**
 * Core notification-send logic, deliberately schema-explicit (see
 * `NotificationsRepository`'s doc comment) rather than request-scoped, so
 * it is reusable by BOTH `NotificationsController` (HTTP, AC1/AC2 -- schema
 * resolved from the tenant `TenantGuard` attaches to the request) and
 * `UserRegisteredEventHandler` (the domain-event consumption path, AC4 --
 * schema resolved from the event's `tenantId` via `TenantsRepository`,
 * bypassing the HTTP guards entirely since it is not an HTTP-triggered
 * call).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly schemaProvisioner: NotificationsSchemaProvisioner,
    private readonly deliveryWorker: NotificationDeliveryWorker,
  ) {}

  /**
   * AC1: renders the template (validated eagerly, before anything is
   * persisted) and dispatches via the configured provider adapter. AC2: the
   * `queued` row is persisted and this method returns BEFORE delivery
   * (including any retries) completes -- `deliveryWorker.deliver()` is
   * intentionally fire-and-forget here so the HTTP response never blocks on
   * however long retries take (AC3).
   */
  async createForSchema(
    schemaName: string,
    dto: CreateNotificationDto,
  ): Promise<NotificationResponse> {
    const template = this.resolveTemplate(dto.templateId);
    await this.schemaProvisioner.ensureProvisioned(schemaName);

    const queuedNotification = {
      id: randomUUID(),
      channel: dto.channel,
      to: dto.to,
      templateId: dto.templateId,
      data: dto.data ?? {},
    };
    const notification = await this.notificationsRepository.insertQueued(
      schemaName,
      queuedNotification,
    );

    // Fire-and-forget: `NotificationDeliveryWorker` persists its own
    // terminal outcome (`sent`/`failed`) directly; there is nothing for the
    // HTTP response to await here, and nothing useful to do with a
    // rejection either (`deliver()` catches provider errors internally --
    // this `.catch` only guards against a truly unexpected bug, e.g. a
    // failure persisting the outcome itself, from becoming an unhandled
    // promise rejection).
    this.deliveryWorker
      .deliver(schemaName, queuedNotification, template)
      .catch((error: unknown) => {
        console.error(
          `Unexpected error delivering notification "${queuedNotification.id}":`,
          error,
        );
      });

    return toNotificationResponseDto(notification);
  }

  /** AC2: the current status/attempts/providerMessageId for a notification id, scoped to this tenant's schema. */
  async findByIdForSchema(
    schemaName: string,
    id: string,
  ): Promise<NotificationResponse> {
    // A tenant whose schema has never had a notification queued yet has no
    // `notifications` table at all (lazy provisioning -- see
    // `NotificationsSchemaProvisioner`); ensure it exists first so a lookup
    // against a schema with zero notifications 404s (not 500s) the same as
    // a lookup for an id that simply doesn't exist.
    await this.schemaProvisioner.ensureProvisioned(schemaName);
    const notification = await this.notificationsRepository.findById(
      schemaName,
      id,
    );
    if (!notification) {
      throw new NotFoundException(`Notification "${id}" was not found.`);
    }
    return toNotificationResponseDto(notification);
  }

  private resolveTemplate(templateId: string): ReturnType<typeof getTemplate> {
    try {
      return getTemplate(templateId);
    } catch (error) {
      if (error instanceof UnknownTemplateError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
