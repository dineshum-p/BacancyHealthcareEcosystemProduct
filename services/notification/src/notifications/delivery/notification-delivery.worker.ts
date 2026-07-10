import { Inject, Injectable } from '@nestjs/common';
import type { NotificationChannel } from '@hep/shared-types';
import { NotificationsRepository } from '../notifications.repository';
import { renderTemplate } from '../templates/render-template.util';
import type { NotificationTemplate } from '../templates/template-registry';
import { NOTIFICATION_PROVIDER_ADAPTER } from '../providers/provider-adapter.tokens';
import type { NotificationProviderAdapter } from '../providers/notification-provider-adapter.interface';
import type { NotificationConfig } from '../../config/notification.config';
import { getNotificationConfig } from '../../config/notification.config';

export interface QueuedNotificationForDelivery {
  id: string;
  channel: NotificationChannel;
  to: string;
  templateId: string;
  data: Record<string, string>;
}

/** Real, `setTimeout`-based delay -- the production default for `sleepFn`. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AC3: attempts delivery via the injected `NotificationProviderAdapter`,
 * retrying a transient failure with exponential backoff
 * (`backoffBaseMs * 2^(attempt-1)` between attempts), and persists the
 * terminal outcome -- `sent` (with `providerMessageId`) on the first
 * success, `failed` (with the last error) only once `maxAttempts` is
 * exhausted. Deliberately does NOT touch `status='queued'` mid-flight: AC2's
 * contract is `queued -> sent` or `queued -> failed`, nothing in between is
 * externally observable via `GET /notifications/:id`.
 *
 * Designed to run fire-and-forget, AFTER an HTTP response has already been
 * sent (`NotificationsService.createForSchema`) -- this is why it takes a
 * plain `schemaName` string rather than a request-scoped tenant-context
 * provider, and why it is also directly reusable by the domain-event
 * consumption path (AC4), which never has an HTTP request at all.
 *
 * A thrown error from the adapter (as opposed to a returned
 * `{ outcome: 'failed' }`) is treated identically -- see
 * `NotificationProviderAdapter`'s doc comment.
 */
@Injectable()
export class NotificationDeliveryWorker {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    @Inject(NOTIFICATION_PROVIDER_ADAPTER)
    private readonly providerAdapter: NotificationProviderAdapter,
    private readonly config: NotificationConfig = getNotificationConfig(),
    private readonly sleepFn: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  async deliver(
    schemaName: string,
    notification: QueuedNotificationForDelivery,
    template: NotificationTemplate,
  ): Promise<void> {
    const content = {
      subject: template.subject
        ? renderTemplate(template.subject, notification.data)
        : undefined,
      body: renderTemplate(template.body, notification.data),
    };

    let lastError = 'Unknown delivery failure.';

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt += 1) {
      const outcome = await this.attemptSend(notification, content);

      if (outcome.outcome === 'sent') {
        await this.notificationsRepository.markSent(
          schemaName,
          notification.id,
          {
            providerMessageId: outcome.providerMessageId,
            attempts: attempt,
          },
        );
        return;
      }

      lastError = outcome.error;
      const isLastAttempt = attempt >= this.config.maxAttempts;
      if (!isLastAttempt) {
        await this.sleepFn(this.config.backoffBaseMs * 2 ** (attempt - 1));
      }
    }

    await this.notificationsRepository.markFailed(schemaName, notification.id, {
      lastError,
      attempts: this.config.maxAttempts,
    });
  }

  /** Normalizes a thrown adapter error into the same `{ outcome: 'failed' }` shape as a returned one. */
  private async attemptSend(
    notification: QueuedNotificationForDelivery,
    content: { subject?: string; body: string },
  ): Promise<
    | { outcome: 'sent'; providerMessageId: string }
    | { outcome: 'failed'; error: string }
  > {
    try {
      return await this.providerAdapter.send(
        notification.channel,
        notification.to,
        content,
      );
    } catch (error) {
      return {
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
