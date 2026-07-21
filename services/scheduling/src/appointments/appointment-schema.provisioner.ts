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
 * schema (BAC-16). Mirrors `services/patient`'s `PatientSchemaProvisioner`/
 * `services/emr`'s `EmrSchemaProvisioner`/`services/billing`'s
 * `BillingSchemaProvisioner` exactly: deliberately does NOT create the
 * schema itself (`services/tenant` owns tenant provisioning; `TenantGuard`
 * only ever admits ACTIVE tenants, whose schema is assumed to already exist
 * by the time any request reaches here), uses `CREATE TABLE` (not
 * `IF NOT EXISTS`, which some SQL engines including `pg-mem` mis-plan against
 * an already-existing table with column constraints) and catches the
 * resulting "already exists" error instead, and caches which schemas have
 * already been provisioned in-process so this never re-runs DDL on every
 * request.
 *
 * `<schema>.appointments` (AC1/AC2/AC3) has no uniqueness constraint on
 * `(provider_id, start_time)`: double-booking is prevented at the
 * APPLICATION layer (`AppointmentsRepository.hasConflict`, checked before
 * every insert/reschedule), not the database layer -- see that repository's
 * doc comment for the trade-off this makes (a check-then-act race under true
 * concurrency is possible and accepted, matching this ticket's explicit
 * "single-provider-at-a-time, no complex conflict detection" scope).
 *
 * Also provisions `<schema>.audit_logs` (`ensureAuditLogsTable`), reusing
 * `services/tenant`'s BAC-8 append-only audit-log DDL/mechanism -- see this
 * service's `audit-logs/` directory doc comments for why the mechanism is
 * duplicated (not literally imported) the same way `TenantGuard`/
 * `AccessTokenGuard` already are across every service in this repo.
 */
@Injectable()
export class AppointmentSchemaProvisioner {
  private readonly provisionedAppointmentsSchemas = new Set<string>();
  private readonly provisionedAuditLogsSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Idempotently ensures `<schema>.appointments` exists. */
  async ensureAppointmentsTable(schemaName: string): Promise<void> {
    if (this.provisionedAppointmentsSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.appointments (
          id UUID PRIMARY KEY,
          provider_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'booked',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedAppointmentsSchemas.add(schemaName);
  }

  /**
   * Idempotently ensures `<schema>.audit_logs` exists (mirrors
   * `services/tenant`'s BAC-8 `TenantSchemaProvisioner.ensureAuditLogsTable`
   * exactly, including its DDL, and every other service's copy). No API in
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
