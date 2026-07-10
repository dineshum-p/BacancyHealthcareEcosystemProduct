import type { NotificationResponse } from '@hep/shared-types';
import { Notification } from '../notification.entity';

/** Maps the internal `Notification` entity to the wire response shape (dates as ISO strings). */
export function toNotificationResponseDto(
  notification: Notification,
): NotificationResponse {
  return {
    id: notification.id,
    channel: notification.channel,
    to: notification.to,
    templateId: notification.templateId,
    status: notification.status,
    providerMessageId: notification.providerMessageId,
    attempts: notification.attempts,
    lastError: notification.lastError,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
}
