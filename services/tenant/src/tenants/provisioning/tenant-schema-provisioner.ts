import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.tokens';
import { quoteSchemaIdentifier } from '../schema-identifier.util';

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
 * Minimum BAC-3 provisioning primitive required for BAC-4 to be real and
 * testable: creates an isolated Postgres schema for a tenant plus a sample
 * table so cross-tenant isolation can be proven end-to-end. The full
 * onboarding flow (plans/billing/etc.) is out of scope here.
 *
 * BAC-8: also provisions each tenant's `audit_logs` table -- the append-only
 * store `AuditLogsRepository` writes every mutation to (see AC5/AC2 in that
 * ticket). `ensureAuditLogsTable` is exposed separately (not just inlined
 * into `provision()`) and is itself idempotent/lazy, mirroring
 * `AuthSchemaProvisioner`'s "ensure" pattern: it can also backfill the table
 * into a tenant schema that was already provisioned by an OLDER version of
 * this service, before `audit_logs` existed, without needing every
 * already-onboarded tenant to be re-provisioned first.
 */
@Injectable()
export class TenantSchemaProvisioner {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async provision(schemaName: string): Promise<void> {
    const schema = quoteSchemaIdentifier(schemaName);
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    try {
      // Deliberately NOT "CREATE TABLE IF NOT EXISTS": some SQL engines
      // (including pg-mem, used in tests) mis-plan that combination when a
      // table with column constraints already exists. Catching the
      // "already exists" error is equally idempotent and portable.
      await this.pool.query(`
        CREATE TABLE ${schema}.items (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    await this.ensureAuditLogsTable(schemaName);
  }

  /**
   * Idempotently ensures `<schema>.audit_logs` exists (BAC-8, AC5). No API
   * ever updates/deletes a row in this table (AC2, append-only) -- this
   * method is the ONLY place its DDL is defined, and it never grants
   * anything beyond `INSERT`/`SELECT` semantics at the application layer
   * (there is no repository method to update or delete a row).
   */
  async ensureAuditLogsTable(schemaName: string): Promise<void> {
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
  }
}
