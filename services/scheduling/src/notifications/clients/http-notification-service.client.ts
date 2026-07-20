import { Injectable, Optional } from '@nestjs/common';
import type {
  AppointmentSummary,
  NotificationChannel,
} from '@hep/shared-types';
import type { NotificationClientConfig } from '../../config/notification-client.config';
import { getNotificationClientConfig } from '../../config/notification-client.config';
import type {
  NotificationClientResult,
  NotificationServiceClient,
} from './notification-service.client';
import { readErrorMessage } from './read-error-message.util';

const INTERNAL_SERVICE_KEY_HEADER = 'X-Internal-Service-Key';

/**
 * Real, `fetch`-backed implementation of `NotificationServiceClient`
 * (BAC-16). Calls `services/notification`'s `POST /notifications/internal`
 * with the `scheduling.appointment.confirmation` template (see that
 * service's `template-registry.ts`) -- mirrors `services/tenant`'s BAC-12
 * `HttpNotificationServiceClient`'s `X-Tenant-Id`/`X-Internal-Service-Key`/
 * timeout handling exactly.
 *
 * Uses `/notifications/internal` (the `InternalServiceGuard`-guarded route),
 * NOT the end-user-facing `POST /notifications`: the caller here is
 * `services/scheduling` itself (a trusted backend service), not a browser
 * forwarding an end user's own bearer token -- same trust-boundary reasoning
 * `services/tenant`'s onboarding orchestration already established.
 */
@Injectable()
export class HttpNotificationServiceClient implements NotificationServiceClient {
  constructor(
    @Optional()
    private readonly config: NotificationClientConfig = getNotificationClientConfig(),
  ) {}

  async sendAppointmentConfirmation(
    tenantId: string,
    channel: NotificationChannel,
    to: string,
    appointment: Pick<AppointmentSummary, 'id' | 'startTime' | 'endTime'>,
  ): Promise<NotificationClientResult> {
    try {
      const response = await fetch(
        `${this.config.notificationServiceUrl}/notifications/internal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
            [INTERNAL_SERVICE_KEY_HEADER]: this.config.internalServiceKey,
          },
          body: JSON.stringify({
            channel,
            to,
            templateId: 'scheduling.appointment.confirmation',
            data: {
              appointmentId: appointment.id,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
            },
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        },
      );

      if (!response.ok) {
        return { outcome: 'failed', error: await readErrorMessage(response) };
      }
      return { outcome: 'succeeded' };
    } catch (error) {
      return {
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
