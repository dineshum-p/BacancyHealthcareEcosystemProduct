import type { NotificationChannel } from '@hep/shared-types';
import { NotificationStatus } from './notification-status.enum';

/** A row in a tenant's `<schema>.notifications` table. */
export interface Notification {
  id: string;
  channel: NotificationChannel;
  to: string;
  templateId: string;
  data: Record<string, string>;
  status: NotificationStatus;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
