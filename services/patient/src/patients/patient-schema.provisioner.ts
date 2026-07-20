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
 * schema (BAC-14). Mirrors `services/emr`'s `EmrSchemaProvisioner`/
 * `services/billing`'s `BillingSchemaProvisioner` (and
 * `services/notification`'s/`services/auth`'s equivalents) exactly:
 * deliberately does NOT create the schema itself (`services/tenant` owns
 * tenant provisioning; `TenantGuard` only ever admits ACTIVE tenants, whose
 * schema is assumed to already exist by the time any request reaches here),
 * uses `CREATE TABLE` (not `IF NOT EXISTS`, which some SQL engines including
 * `pg-mem` mis-plan against an already-existing table with column
 * constraints) and catches the resulting "already exists" error instead, and
 * caches which schemas have already been provisioned in-process so this
 * never re-runs DDL on every request.
 *
 * `<schema>.patient_mrn_counters` (AC1/AC2) is a single-row-per-tenant
 * counter table, NOT a Postgres `SEQUENCE`: `pg-mem` (this repo's Postgres
 * stand-in for tests, see `test/support/create-in-memory-pool.ts`) does not
 * support `CREATE SEQUENCE`/`nextval()`, so `PatientsRepository.nextMrn`
 * instead does an atomic `UPDATE ... SET next_value = next_value + 1
 * RETURNING next_value - 1` against this single seeded row -- a real
 * Postgres row-level lock on that UPDATE serializes concurrent callers just
 * as reliably as a sequence would, and it works identically against both
 * engines. One row per tenant SCHEMA (not a shared/global table), so a
 * tenant's MRN numbering is entirely independent of every other tenant's
 * (AC2).
 *
 * Also provisions `<schema>.audit_logs` (`ensureAuditLogsTable`), reusing
 * `services/tenant`'s BAC-8 append-only audit-log DDL/mechanism -- see this
 * service's `audit-logs/` directory doc comments for why the mechanism is
 * duplicated (not literally imported) the same way `TenantGuard`/
 * `AccessTokenGuard` already are across every service in this repo.
 */
@Injectable()
export class PatientSchemaProvisioner {
  private readonly provisionedPatientsSchemas = new Set<string>();
  private readonly provisionedAuditLogsSchemas = new Set<string>();
  private readonly provisionedSelfRegistrationsSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Idempotently ensures `<schema>.patients` AND `<schema>.patient_mrn_counters`
   * exist, seeding the latter's single counter row (AC1/AC2).
   */
  async ensurePatientsTable(schemaName: string): Promise<void> {
    if (this.provisionedPatientsSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.patients (
          id UUID PRIMARY KEY,
          mrn TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          date_of_birth DATE NOT NULL,
          gender TEXT NULL,
          phone TEXT NULL,
          email TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT patients_mrn_unique UNIQUE (mrn)
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.patient_mrn_counters (
          id INTEGER PRIMARY KEY,
          next_value INTEGER NOT NULL
        )
      `);
      await this.pool.query(
        `INSERT INTO ${schema}.patient_mrn_counters (id, next_value) VALUES (1, 1)`,
      );
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
   * exactly, including its DDL, and `services/emr`'s/`services/billing`'s
   * copies). No API in this service ever updates/deletes a row in this
   * table -- `AuditLogsRepository` only ever inserts.
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
   * Idempotently ensures `<schema>.patient_self_registrations` exists
   * (BAC-36): one row per patient-submitted online registration, distinct
   * from `<schema>.patients` -- a self-registration only ever becomes a real
   * `patients` row (with an MRN) once staff approve it
   * (`PatientSelfRegistrationsService.approve`); until then it lives ONLY
   * here, which is what keeps it out of `GET /patients` search (BAC-36's AC)
   * without that endpoint needing any status filtering of its own.
   *
   * `matched_patient_id`/`match_reason` record duplicate-detection's result
   * at submission time (nullable: no candidate found); `resulting_patient_id`
   * is set once reviewed (the newly created patient's id on approval, or the
   * matched existing patient's id on merge). No foreign-key constraints
   * against `<schema>.patients` -- consistent with this service's other
   * tables (e.g. `patients.mrn`'s own uniqueness constraint is the only FK-
   * like constraint anywhere in this schema) and friendlier to `pg-mem`.
   */
  async ensureSelfRegistrationsTable(schemaName: string): Promise<void> {
    if (this.provisionedSelfRegistrationsSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.patient_self_registrations (
          id UUID PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          date_of_birth DATE NOT NULL,
          gender TEXT NULL,
          phone TEXT NULL,
          email TEXT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          matched_patient_id TEXT NULL,
          match_reason TEXT NULL,
          resulting_patient_id TEXT NULL,
          review_note TEXT NULL,
          reviewed_by TEXT NULL,
          reviewed_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedSelfRegistrationsSchemas.add(schemaName);
  }
}
