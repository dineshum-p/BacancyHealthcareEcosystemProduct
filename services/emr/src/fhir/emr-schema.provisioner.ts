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
 * schema (BAC-10). Mirrors `services/notification`'s
 * `NotificationsSchemaProvisioner` and `services/auth`'s
 * `AuthSchemaProvisioner` exactly: deliberately does NOT create the schema
 * itself (`services/tenant` owns tenant provisioning; `TenantGuard` only
 * ever admits ACTIVE tenants, whose schema is assumed to already exist by
 * the time any request reaches here), uses `CREATE TABLE` (not
 * `IF NOT EXISTS`, which some SQL engines including `pg-mem` mis-plan
 * against an already-existing table with column constraints) and catches
 * the resulting "already exists" error instead, and caches which schemas
 * have already been provisioned in-process so this never re-runs DDL on
 * every request.
 *
 * Also provisions `<schema>.audit_logs` (`ensureAuditLogsTable`), reusing
 * `services/tenant`'s BAC-8 append-only audit-log DDL/mechanism -- see this
 * service's `audit-logs/` directory doc comments for why the mechanism is
 * duplicated (not literally imported) the same way `TenantGuard`/
 * `AccessTokenGuard` already are across every service in this repo.
 *
 * Also provisions `<schema>.encounters` (`ensureEncountersTable`, BAC-15):
 * a tenant-scoped SOAP-encounter-note table. SOAP fields
 * (subjective/objective/assessment/plan) and vitals are explicit columns
 * (structured, queryable, and consistent with `services/patient`'s
 * BAC-14 `patients` table convention of explicit columns over a JSONB
 * blob for well-known fields); `allergies` is a JSONB array since it is a
 * variable-length list of structured entries, mirroring this service's own
 * BAC-10 `patients.resource` JSONB-document convention for that shape of
 * data.
 */
@Injectable()
export class EmrSchemaProvisioner {
  private readonly provisionedPatientsSchemas = new Set<string>();
  private readonly provisionedAuditLogsSchemas = new Set<string>();
  private readonly provisionedEncountersSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Idempotently ensures `<schema>.patients` exists (BAC-10, AC1/AC2). */
  async ensurePatientsTable(schemaName: string): Promise<void> {
    if (this.provisionedPatientsSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.patients (
          id UUID PRIMARY KEY,
          resource JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedPatientsSchemas.add(schemaName);
  }

  /**
   * Idempotently ensures `<schema>.audit_logs` exists (mirrors
   * `services/tenant`'s BAC-8 `TenantSchemaProvisioner.ensureAuditLogsTable`
   * exactly, including its DDL). No API in this service ever updates/deletes
   * a row in this table -- `AuditLogsRepository` only ever inserts.
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

  /**
   * Idempotently ensures `<schema>.encounters` exists (BAC-15, AC1/AC2).
   * Vitals columns are nullable `NUMERIC` (a provider may not capture every
   * vital at every visit; `CreateEncounterDto` is the layer that enforces
   * plausible clinical ranges, AC3, not this DDL). `allergies` defaults to
   * an empty JSONB array so a row always has a well-formed (never `NULL`)
   * list to deserialize.
   */
  async ensureEncountersTable(schemaName: string): Promise<void> {
    if (this.provisionedEncountersSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.encounters (
          id UUID PRIMARY KEY,
          patient_id UUID NOT NULL,
          subjective TEXT NOT NULL,
          objective TEXT NOT NULL,
          assessment TEXT NOT NULL,
          plan TEXT NOT NULL,
          heart_rate NUMERIC NULL,
          blood_pressure_systolic NUMERIC NULL,
          blood_pressure_diastolic NUMERIC NULL,
          temperature NUMERIC NULL,
          respiratory_rate NUMERIC NULL,
          spo2 NUMERIC NULL,
          allergies JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedEncountersSchemas.add(schemaName);
  }
}
