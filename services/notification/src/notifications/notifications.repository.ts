import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { NotificationChannel } from '@hep/shared-types';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { Notification } from './notification.entity';
import { NotificationStatus } from './notification-status.enum';

interface NotificationRow {
  id: string;
  channel: string;
  to_address: string;
  template_id: string;
  data: Record<string, string> | string;
  status: string;
  provider_message_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

const NOTIFICATION_COLUMNS =
  'id, channel, to_address, template_id, data, status, provider_message_id, attempts, last_error, created_at, updated_at';

export interface NewQueuedNotification {
  id: string;
  channel: NotificationChannel;
  to: string;
  templateId: string;
  data: Record<string, string>;
}

export interface MarkSentFields {
  providerMessageId: string;
  attempts: number;
}

export interface MarkFailedFields {
  lastError: string;
  attempts: number;
}

/**
 * Data access for a tenant's `<schema>.notifications` table. Deliberately
 * takes an explicit `schemaName` parameter on every method rather than
 * depending on a request-scoped tenant-context provider (the pattern
 * `services/tenant`/`services/auth` use elsewhere): `NotificationDeliveryWorker`
 * (AC3's retry/backoff) runs fire-and-forget AFTER the HTTP response has
 * already been sent (AC2 -- the response must not block on delivery), by
 * which point any request-scoped provider would already be torn down. The
 * same primitive is also reused, unmodified, by the domain-event
 * consumption path (AC4), which has no HTTP request at all. Every query is
 * still fully-qualified with the given schema (defense in depth, same
 * pattern as `ItemsRepository`/`UsersRepository`).
 */
@Injectable()
export class NotificationsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertQueued(
    schemaName: string,
    notification: NewQueuedNotification,
  ): Promise<Notification> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<NotificationRow> = await this.pool.query(
      `INSERT INTO ${schema}.notifications (id, channel, to_address, template_id, data, status, attempts)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING ${NOTIFICATION_COLUMNS}`,
      [
        notification.id,
        notification.channel,
        notification.to,
        notification.templateId,
        JSON.stringify(notification.data),
        NotificationStatus.QUEUED,
      ],
    );
    return this.toEntity(result.rows[0]);
  }

  async findById(schemaName: string, id: string): Promise<Notification | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<NotificationRow> = await this.pool.query(
      `SELECT ${NOTIFICATION_COLUMNS} FROM ${schema}.notifications WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  async markSent(
    schemaName: string,
    id: string,
    fields: MarkSentFields,
  ): Promise<void> {
    const schema = quoteSchemaIdentifier(schemaName);
    await this.pool.query(
      `UPDATE ${schema}.notifications
       SET status = $2, provider_message_id = $3, attempts = $4, updated_at = now()
       WHERE id = $1`,
      [id, NotificationStatus.SENT, fields.providerMessageId, fields.attempts],
    );
  }

  async markFailed(
    schemaName: string,
    id: string,
    fields: MarkFailedFields,
  ): Promise<void> {
    const schema = quoteSchemaIdentifier(schemaName);
    await this.pool.query(
      `UPDATE ${schema}.notifications
       SET status = $2, last_error = $3, attempts = $4, updated_at = now()
       WHERE id = $1`,
      [id, NotificationStatus.FAILED, fields.lastError, fields.attempts],
    );
  }

  private toEntity(row: NotificationRow): Notification {
    return {
      id: row.id,
      channel: row.channel as NotificationChannel,
      to: row.to_address,
      templateId: row.template_id,
      data:
        typeof row.data === 'string'
          ? (JSON.parse(row.data) as Record<string, string>)
          : row.data,
      status: row.status as NotificationStatus,
      providerMessageId: row.provider_message_id,
      attempts: row.attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
