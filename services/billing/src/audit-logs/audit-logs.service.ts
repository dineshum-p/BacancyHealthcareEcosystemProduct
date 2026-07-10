import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogEntry } from './audit-log.entity';

export type RecordAuditLogInput = Omit<AuditLogEntry, 'id' | 'createdAt'>;

/**
 * Business logic for audit-log entries, mirroring `services/tenant`'s BAC-8
 * `AuditLogsService` (and `services/emr`'s BAC-10 copy): `record` is called
 * by `AuditLogInterceptor` after every audited mutation. Always takes an
 * explicit `schemaName` -- resolved by the caller via
 * `resolveAuditTarget`/`request.tenant`, never re-derived here -- keeping
 * this service a plain (non-request-scoped) singleton.
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
}
