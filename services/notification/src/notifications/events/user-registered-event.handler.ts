import { Injectable } from '@nestjs/common';
import type {
  NotificationResponse,
  UserRegisteredEvent,
} from '@hep/shared-types';
import { TenantsRepository } from '../../tenants/tenants.repository';
import { TenantStatus } from '../../tenants/tenant-status.enum';
import { NotificationsService } from '../notifications.service';
import { UnknownTenantForEventError } from '../errors/unknown-tenant-for-event.error';

/**
 * AC4: maps a consumed `user.registered` domain event to the corresponding
 * notification-send call. This is the CONSUMPTION side only -- see
 * `events/README.md` for the explicit scope boundary (no real broker, and
 * `services/auth` does not publish this event today).
 *
 * Deliberately calls `NotificationsService.createForSchema` directly,
 * bypassing `NotificationsController`/`TenantGuard`/`AccessTokenGuard`
 * entirely: this is a non-HTTP trigger (an event off a message bus, not a
 * request from an end user), so there is no bearer token or `X-Tenant-Id`
 * header to check -- the event's own `tenantId` claim is resolved directly
 * via `TenantsRepository`, and only an ACTIVE tenant is honoured (same
 * admission rule `TenantGuard` enforces for HTTP callers).
 */
@Injectable()
export class UserRegisteredEventHandler {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: UserRegisteredEvent): Promise<NotificationResponse> {
    const tenant = await this.tenantsRepository.findById(event.tenantId);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new UnknownTenantForEventError(event.tenantId);
    }

    return this.notificationsService.createForSchema(tenant.schemaName, {
      channel: 'email',
      to: event.email,
      templateId: 'user.registered.welcome',
      data: {
        userName: event.name ?? event.email,
        tenantName: tenant.name,
        email: event.email,
      },
    });
  }
}
