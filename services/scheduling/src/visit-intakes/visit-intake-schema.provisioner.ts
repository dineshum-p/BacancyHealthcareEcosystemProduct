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
 * Ensures `<schema>.visit_intakes` exists inside a tenant's Postgres schema
 * (BAC-45), mirroring `AppointmentSchemaProvisioner`'s/`services/emr`'s
 * `EmrSchemaProvisioner`'s exact conventions: `CREATE TABLE` (not
 * `IF NOT EXISTS`, which `pg-mem` mis-plans against an already-existing
 * table with column constraints) with the resulting "already exists" error
 * caught, and an in-process cache of already-provisioned schemas so this
 * never re-runs DDL on every request.
 *
 * `reason_for_visit`/`symptoms`/`whats_new_since_last_visit` are `BYTEA` --
 * encrypted at the COLUMN level via Postgres's `pgcrypto` extension
 * (`pgp_sym_encrypt`/`pgp_sym_decrypt`, see `VisitIntakesRepository`),
 * replicating BAC-44's `EmrSchemaProvisioner.ensurePatientProfilesTable`
 * pattern exactly (including running `CREATE EXTENSION IF NOT EXISTS
 * pgcrypto` here, idempotently, the first time this table is provisioned for
 * a tenant).
 *
 * Deliberately NO uniqueness constraint on `patient_id` (unlike BAC-44's
 * `patient_profiles.patient_id UNIQUE`): every `POST /visit-intakes` must
 * insert a brand-new row, never upsert/merge into a prior one -- see
 * `visit-intakes.entity.ts`'s doc comment.
 */
@Injectable()
export class VisitIntakeSchemaProvisioner {
  private readonly provisionedVisitIntakesSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Idempotently ensures `<schema>.visit_intakes` exists. */
  async ensureVisitIntakesTable(schemaName: string): Promise<void> {
    if (this.provisionedVisitIntakesSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    await this.pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    try {
      await this.pool.query(`
        CREATE TABLE ${schema}.visit_intakes (
          id UUID PRIMARY KEY,
          patient_id TEXT NOT NULL,
          reason_for_visit BYTEA NOT NULL,
          symptoms BYTEA NOT NULL,
          whats_new_since_last_visit BYTEA NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          assigned_provider_id TEXT NULL,
          appointment_id TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedVisitIntakesSchemas.add(schemaName);
  }
}
