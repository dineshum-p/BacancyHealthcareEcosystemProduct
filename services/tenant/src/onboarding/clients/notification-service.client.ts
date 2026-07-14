import type { OrchestrationStepResult } from './orchestration-step-result.interface';

/**
 * Port over which `OnboardingService` queues a brand-new tenant's
 * admin-invite email (BAC-12, step c). A real, synchronous HTTP call to
 * `services/notification`'s `POST /notifications/internal` -- see
 * `AuthServiceClient`'s doc comment for why this is a real inter-service
 * HTTP call, not a domain event.
 *
 * Only queuing (not actual delivery) is this client's concern: BAC-9's
 * `NotificationDeliveryWorker` already retries actual send failures with
 * backoff, asynchronously, AFTER `POST /notifications/internal` returns --
 * see `OnboardingService`'s doc comment for the full division of retry
 * responsibility.
 */
export interface NotificationServiceClient {
  sendAdminInvite(
    tenantId: string,
    email: string,
    tenantName: string,
  ): Promise<OrchestrationStepResult>;
}

export const NOTIFICATION_SERVICE_CLIENT = Symbol(
  'NOTIFICATION_SERVICE_CLIENT',
);
