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
  }
}
