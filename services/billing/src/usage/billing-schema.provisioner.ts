import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';

const POSTGRES_DUPLICATE_TABLE = '42P07';

function isTableAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: string }).code;
  return (
    code === POSTGRES_DUPLICATE_TABLE ||
    error.message.includes('already exists')
  );
}

/**
 * Ensures this service's own domain tables exist inside a tenant's Postgres
 * schema (BAC-11). Mirrors `services/emr`'s `EmrSchemaProvisioner` (and
 * `services/notification`'s/`services/auth`'s equivalents) exactly:
 * deliberately does NOT create the schema itself (`services/tenant` owns
 * tenant provisioning; `TenantGuard` only ever admits ACTIVE tenants, whose
 * schema is assumed to already exist by the time any request reaches here),
 * uses `CREATE TABLE` (not `IF NOT EXISTS`, which some SQL engines including
 * `pg-mem` mis-plan against an already-existing table with column
 * constraints) and catches the resulting "already exists" error instead,
 * and caches which schemas have already been provisioned in-process so this
 * never re-runs DDL on every request.
 *
 * Also provisions `<schema>.audit_logs` (`ensureAuditLogsTable`), reusing
 * `services/tenant`'s BAC-8 append-only audit-log DDL/mechanism -- see this
 * service's `audit-logs/` directory doc comments for why the mechanism is
 * duplicated (not literally imported) the same way `TenantGuard`/
 * `AccessTokenGuard` already are across every service in this repo.
 */
@Injectable()
export class BillingSchemaProvisioner {
  private readonly provisionedUsageEventsSchemas = new Set<string>();
  private readonly provisionedAuditLogsSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Idempotently ensures `<schema>.usage_events` exists (BAC-11, AC1/AC3).
   * `event_id` carries a UNIQUE constraint -- the idempotency mechanism
   * `UsageEventsRepository` relies on (`INSERT ... ON CONFLICT (event_id)
   * DO NOTHING`) to guarantee a duplicate event id never double-counts
   * usage, no matter how many times it is (re-)delivered.
   */
  async ensureUsageEventsTable(schemaName: string): Promise<void> {
    if (this.provisionedUsageEventsSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.usage_events (
          id UUID PRIMARY KEY,
          event_id TEXT NOT NULL,
          metric TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT usage_events_event_id_unique UNIQUE (event_id)
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedUsageEventsSchemas.add(schemaName);
  }

  /**
   * Idempotently ensures `<schema>.audit_logs` exists (mirrors
   * `services/tenant`'s BAC-8 `TenantSchemaProvisioner.ensureAuditLogsTable`
   * exactly, including its DDL, and `services/emr`'s BAC-10 copy). No API in
   * this service ever updates/deletes a row in this table --
   * `AuditLogsRepository` only ever inserts.
   */
  async ensureAuditLogsTable(schemaName: string): Promise<void> {
    if (this.provisionedAuditLogsSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.audit_logs (
          id UUID PRIMARY KEY,
          actor_user_id TEXT NULL,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NULL,
          before JSONB NULL,
          after JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedAuditLogsSchemas.add(schemaName);
  }
}
