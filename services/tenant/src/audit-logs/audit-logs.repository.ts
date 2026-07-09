import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { TenantSchemaProvisioner } from '../tenants/provisioning/tenant-schema-provisioner';
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

export interface AuditLogFilter {
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
}

/**
 * Data access for a tenant schema's `audit_logs` table (BAC-8, AC5). Always
 * takes an explicit `schemaName` rather than going through the request
 * -scoped `TenantContextService`: `insert` must work even for `POST
 * /tenants`, which runs BEFORE any tenant is resolved on the request (see
 * `resolveAuditTarget`'s doc comment) -- there is no per-request schema
 * -bound client to reuse in that case, only the schema name of the tenant
 * that was just created. Every query fully-qualifies `schema.audit_logs`
 * (never relies on `search_path`), same convention as `ItemsRepository`.
 *
 * Append-only (AC2): this class deliberately has no `update`/`delete`
 * method. That is the entire enforcement mechanism -- there is simply no
 * code path, anywhere in this service, that can mutate a persisted row.
 */
@Injectable()
export class AuditLogsRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly schemaProvisioner: TenantSchemaProvisioner,
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

  async findAll(
    schemaName: string,
    filter: AuditLogFilter,
    pagination: Pagination,
  ): Promise<AuditLogPage> {
    await this.schemaProvisioner.ensureAuditLogsTable(schemaName);
    const schema = quoteSchemaIdentifier(schemaName);

    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.actorUserId) {
      values.push(filter.actorUserId);
      conditions.push(`actor_user_id = $${values.length}`);
    }
    if (filter.resourceType) {
      values.push(filter.resourceType);
      conditions.push(`resource_type = $${values.length}`);
    }
    if (filter.resourceId) {
      values.push(filter.resourceId);
      conditions.push(`resource_id = $${values.length}`);
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const countResult: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM ${schema}.audit_logs ${whereClause}`,
      values,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const limitValues = [
      ...values,
      pagination.limit,
      (pagination.page - 1) * pagination.limit,
    ];
    const limitIndex = limitValues.length - 1;
    const offsetIndex = limitValues.length;

    const result: QueryResult<AuditLogRow> = await this.pool.query(
      `SELECT id, actor_user_id, action, resource_type, resource_id, before, after, created_at
       FROM ${schema}.audit_logs
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      limitValues,
    );

    return { items: result.rows.map((row) => this.toEntity(row)), total };
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
