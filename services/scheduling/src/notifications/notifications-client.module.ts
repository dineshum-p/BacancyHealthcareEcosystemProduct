import { Module } from '@nestjs/common';
import { NOTIFICATION_SERVICE_CLIENT } from './clients/notification-service.client';
import { HttpNotificationServiceClient } from './clients/http-notification-service.client';

/**
 * Binds `NOTIFICATION_SERVICE_CLIENT` to the real, `fetch`-backed
 * implementation (BAC-16). Tests override this provider with a fake/mock
 * (mirrors `services/patient`'s `DOMAIN_EVENT_PUBLISHER` override convention
 * for its own e2e suite) so no test ever makes a real network call to
 * `services/notification`.
 */
@Module({
  providers: [
    {
      provide: NOTIFICATION_SERVICE_CLIENT,
      useClass: HttpNotificationServiceClient,
    },
  ],
  exports: [NOTIFICATION_SERVICE_CLIENT],
})
export class NotificationsClientModule {}
