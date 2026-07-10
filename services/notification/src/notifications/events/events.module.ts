import { Module } from '@nestjs/common';
import { TenantContextModule } from '../../tenant-context/tenant-context.module';
import { NotificationsModule } from '../notifications.module';
import { UserRegisteredEventHandler } from './user-registered-event.handler';
import { EventConsumerBootstrapService } from './event-consumer-bootstrap.service';

/**
 * AC4's domain-event consumption wiring: `UserRegisteredEventHandler` (the
 * event-to-notification mapping logic) plus `EventConsumerBootstrapService`
 * (starts/stops the real Kafka consumer, but only when
 * `KAFKA_CONSUMER_ENABLED=true` -- see that service's doc comment and
 * `events/README.md` for the full scope boundary).
 *
 * `TenantContextModule` is imported for `TenantsRepository`
 * (`UserRegisteredEventHandler` resolves the event's `tenantId` directly,
 * bypassing `TenantGuard` entirely -- this is not an HTTP request).
 * `NotificationsModule` is imported for `NotificationsService`, so this
 * reuses the exact same queue-and-deliver pipeline `POST /notifications`
 * uses.
 */
@Module({
  imports: [TenantContextModule, NotificationsModule],
  providers: [UserRegisteredEventHandler, EventConsumerBootstrapService],
})
export class EventsModule {}
