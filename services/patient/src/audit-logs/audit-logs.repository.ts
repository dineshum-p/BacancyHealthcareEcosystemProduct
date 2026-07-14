import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { PatientSchemaProvisioner } from '../patients/patient-schema.provisioner';
import { AuditLogEntry } from './audit-log.entity';

interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before: unknown;
  after: unknown;
  created_at: Date;
}

/**
 * Data access for a tenant schema's `audit_logs` table, mirroring
 * `services/tenant`'s BAC-8 `AuditLogsRepository` (and `services/emr`'s/
 * `services/billing`'s copies) -- the read/`GET /audit-logs` side is out of
 * this ticket's scope, so only `insert` is ported. Append-only: this class
 * deliberately has no `update`/`delete` method.
 */
@Injectable()
export class AuditLogsRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly schemaProvisioner: PatientSchemaProvisioner,
  ) {}

  async insert(
    schemaName: string,
    entry: Omit<AuditLogEntry, 'createdAt'>,
  ): Promise<void> {
    await this.schemaProvisioner.ensureAuditLogsTable(schemaName);
    const schema = quoteSchemaIdentifier(schemaName);

    await this.pool.query(
      `INSERT INTO ${schema}.audit_logs
         (id, actor_user_id, action, resource_type, resource_id, before, after)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.id,
        entry.actorUserId,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.before === null ? null : JSON.stringify(entry.before),
        entry.after === null || entry.after === undefined
          ? null
          : JSON.stringify(entry.after),
      ],
    );
  }

  async findAll(schemaName: string): Promise<AuditLogEntry[]> {
    await this.schemaProvisioner.ensureAuditLogsTable(schemaName);
    const schema = quoteSchemaIdentifier(schemaName);

    const result = await this.pool.query<AuditLogRow>(
      `SELECT id, actor_user_id, action, resource_type, resource_id, before, after, created_at
       FROM ${schema}.audit_logs
       ORDER BY created_at DESC, id DESC`,
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: AuditLogRow): AuditLogEntry {
    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      before: row.before ?? null,
      after: row.after ?? null,
      createdAt: row.created_at,
    };
  }
}
