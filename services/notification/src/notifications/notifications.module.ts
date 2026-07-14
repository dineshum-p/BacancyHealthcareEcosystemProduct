import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { InternalServiceGuard } from '../auth/internal-service.guard';
import { ProviderAdapterModule } from './providers/provider-adapter.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsSchemaProvisioner } from './notifications-schema.provisioner';
import { NotificationDeliveryWorker } from './delivery/notification-delivery.worker';

/**
 * `TenantContextModule` and `AuthModule` are imported directly (same reason
 * `services/tenant`'s `ItemsModule` imports `TenantsModule` alongside
 * `TenantContextModule`): `@UseGuards(TenantGuard, AccessTokenGuard)` makes
 * Nest instantiate those guards using THIS module's own injector, so their
 * constructor dependencies must be visible here too.
 *
 * `NotificationsService`/`NotificationsRepository`/
 * `NotificationsSchemaProvisioner`/`NotificationDeliveryWorker` are all
 * exported so `UserRegisteredEventHandler` (AC4, added in a later commit)
 * can reuse this exact send pipeline without going through HTTP/these
 * guards at all.
 */
@Module({
  imports: [TenantContextModule, AuthModule, ProviderAdapterModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsSchemaProvisioner,
    NotificationDeliveryWorker,
    InternalServiceGuard,
  ],
  exports: [
    NotificationsService,
    NotificationsRepository,
    NotificationsSchemaProvisioner,
    NotificationDeliveryWorker,
  ],
})
export class NotificationsModule {}
