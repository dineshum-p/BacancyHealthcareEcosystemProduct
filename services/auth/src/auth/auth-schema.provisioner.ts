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
 * Ensures this service's own domain tables (`users`, `refresh_tokens`) exist
 * inside a tenant's Postgres schema.
 *
 * Deliberately does NOT create the schema itself: `services/tenant` (BAC-3)
 * owns tenant provisioning, and `TenantGuard` only ever admits ACTIVE
 * tenants, whose schema is assumed to already exist by the time any request
 * reaches here. This provisioner only adds the auth-domain tables to that
 * pre-existing schema, lazily, the first time this process needs them --
 * decoupling the two independently-deployable services (`services/auth`
 * never has to be told when a new tenant is onboarded).
 *
 * Mirrors `services/tenant`'s `TenantSchemaProvisioner`: uses `CREATE TABLE`
 * (not `CREATE TABLE IF NOT EXISTS`, which some SQL engines including
 * `pg-mem` mis-plan against an already-existing table with column
 * constraints) and catches the resulting "already exists" error instead.
 */
@Injectable()
export class AuthSchemaProvisioner {
  private readonly provisionedSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async ensureProvisioned(schemaName: string): Promise<void> {
    if (this.provisionedSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    await this.createTableIfMissing(
      `CREATE TABLE ${schema}.users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        mfa_status TEXT NOT NULL DEFAULT 'none',
        mfa_secret_encrypted TEXT NULL,
        mfa_last_used_step BIGINT NULL,
        first_name TEXT NULL,
        last_name TEXT NULL,
        date_of_birth DATE NULL,
        UNIQUE (email)
      )`,
    );
    // Defensive migration (BAC-6) for a schema that was already provisioned
    // by an older version of this service, before the MFA columns existed:
    // `CREATE TABLE` above no-ops via `isTableAlreadyExistsError` in that
    // case, so backfill the columns explicitly. `pg-mem` and real Postgres
    // both support `ADD COLUMN IF NOT EXISTS`, so this is a cheap no-op for
    // freshly-created tables too.
    await this.pool.query(
      `ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS mfa_status TEXT NOT NULL DEFAULT 'none'`,
    );
    await this.pool.query(
      `ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT NULL`,
    );
    await this.pool.query(
      `ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT NULL`,
    );
    // Same defensive-migration pattern (BAC-42): backfills the patient
    // sign-up identity columns for a schema provisioned before they existed.
    await this.pool.query(
      `ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS first_name TEXT NULL`,
    );
    await this.pool.query(
      `ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS last_name TEXT NULL`,
    );
    await this.pool.query(
      `ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL`,
    );

    await this.createTableIfMissing(
      `CREATE TABLE ${schema}.refresh_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (token_hash)
      )`,
    );

    // BAC-6: recovery-code hashes, never the raw codes (see
    // `recovery-code.util.ts`). No redemption endpoint exists yet (deliberate
    // scope call -- see BAC-6 report), so rows are write-only for now.
    await this.createTableIfMissing(
      `CREATE TABLE ${schema}.mfa_recovery_codes (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        code_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (code_hash)
      )`,
    );

    this.provisionedSchemas.add(schemaName);
  }

  private async createTableIfMissing(ddl: string): Promise<void> {
    try {
      await this.pool.query(ddl);
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }
  }
}
