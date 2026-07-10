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
 * Ensures this service's own domain table (`notifications`) exists inside a
 * tenant's Postgres schema. Mirrors `services/auth`'s `AuthSchemaProvisioner`
 * exactly: deliberately does NOT create the schema itself (`services/tenant`
 * owns tenant provisioning; `TenantGuard` only ever admits ACTIVE tenants,
 * whose schema is assumed to already exist by the time any request reaches
 * here), uses `CREATE TABLE` (not `IF NOT EXISTS`, which some SQL engines
 * including `pg-mem` mis-plan against an already-existing table with column
 * constraints) and catches the resulting "already exists" error instead, and
 * caches which schemas have already been provisioned in-process so this
 * never re-runs DDL on every request.
 */
@Injectable()
export class NotificationsSchemaProvisioner {
  private readonly provisionedSchemas = new Set<string>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async ensureProvisioned(schemaName: string): Promise<void> {
    if (this.provisionedSchemas.has(schemaName)) {
      return;
    }
    const schema = quoteSchemaIdentifier(schemaName);

    try {
      await this.pool.query(
        `CREATE TABLE ${schema}.notifications (
          id UUID PRIMARY KEY,
          channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
          to_address TEXT NOT NULL,
          template_id TEXT NOT NULL,
          data JSONB NOT NULL DEFAULT '{}',
          status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')) DEFAULT 'queued',
          provider_message_id TEXT NULL,
          attempts INT NOT NULL DEFAULT 0,
          last_error TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
      );
    } catch (error) {
      if (!isTableAlreadyExistsError(error)) {
        throw error;
      }
    }

    this.provisionedSchemas.add(schemaName);
  }
}
