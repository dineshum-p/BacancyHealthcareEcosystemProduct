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
        UNIQUE (email)
      )`,
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
