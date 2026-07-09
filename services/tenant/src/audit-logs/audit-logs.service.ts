import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogEntry } from './audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import {
  AuditLogResponseDto,
  PaginatedAuditLogsDto,
} from './dto/audit-log-response.dto';

export type RecordAuditLogInput = Omit<AuditLogEntry, 'id' | 'createdAt'>;

/**
 * Business logic for audit-log entries (BAC-8): `record` is called by
 * `AuditLogInterceptor` after every audited mutation; `list` backs
 * `GET /audit-logs`. Both always take an explicit `schemaName` -- resolved
 * by the caller via `resolveAuditTarget`/`request.tenant`, never re-derived
 * here -- keeping this service a plain (non-request-scoped) singleton.
 */
@Injectable()
export class AuditLogsService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async record(schemaName: string, input: RecordAuditLogInput): Promise<void> {
    await this.auditLogsRepository.insert(schemaName, {
      id: randomUUID(),
      ...input,
    });
  }

  async list(
    schemaName: string,
    query: AuditLogQueryDto,
  ): Promise<PaginatedAuditLogsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.auditLogsRepository.findAll(
      schemaName,
      {
        actorUserId: query.actor,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
      },
      { page, limit },
    );

    return {
      items: items.map((item) => this.toResponseDto(item)),
      page,
      limit,
      total,
    };
  }

  private toResponseDto(entry: AuditLogEntry): AuditLogResponseDto {
    return {
      id: entry.id,
      actorUserId: entry.actorUserId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: entry.before,
      after: entry.after,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
