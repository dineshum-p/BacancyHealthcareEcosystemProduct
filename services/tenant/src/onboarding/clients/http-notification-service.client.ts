import { Injectable, Optional } from '@nestjs/common';
import type { OnboardingConfig } from '../config/onboarding.config';
import { getOnboardingConfig } from '../config/onboarding.config';
import type { NotificationServiceClient } from './notification-service.client';
import type { OrchestrationStepResult } from './orchestration-step-result.interface';
import { readErrorMessage } from './read-error-message.util';

const INTERNAL_SERVICE_KEY_HEADER = 'X-Internal-Service-Key';

/**
 * Real, `fetch`-backed implementation of `NotificationServiceClient`
 * (BAC-12). Calls `services/notification`'s `POST /notifications/internal`
 * with the `tenant.onboarding.admin-invite` template (see that service's
 * `template-registry.ts`) -- mirrors `HttpAuthServiceClient`'s
 * `X-Tenant-Id`/`X-Internal-Service-Key`/timeout handling exactly.
 */
@Injectable()
export class HttpNotificationServiceClient implements NotificationServiceClient {
  constructor(
    @Optional()
    private readonly config: OnboardingConfig = getOnboardingConfig(),
  ) {}

  async sendAdminInvite(
    tenantId: string,
    email: string,
    tenantName: string,
  ): Promise<OrchestrationStepResult> {
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
            channel: 'email',
            to: email,
            templateId: 'tenant.onboarding.admin-invite',
            data: { tenantName, email },
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
