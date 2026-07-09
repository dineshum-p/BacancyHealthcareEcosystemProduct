import { newDb } from 'pg-mem';
import { Pool } from 'pg';

/**
 * A real (not mocked) SQL engine standing in for Postgres in tests that
 * don't have a docker daemon available. It executes actual SQL text via a
 * `pg`-compatible `Pool`/`Client` API, so repositories/services under test
 * run unmodified against it -- only the connection factory differs from
 * production, which points at real Postgres (see docker-compose.test.yml).
 *
 * pg-mem does not implement `SET search_path` (it is a documented no-op),
 * so all schema-scoped SQL in this codebase fully-qualifies table names
 * rather than relying on it -- see `ItemsRepository`.
 */
export function createInMemoryPool(): Pool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  // pg-mem types `createPg()` loosely (`Pool: any`); narrow it to the real
  // `pg` Pool constructor shape so the rest of the codebase can treat this
  // exactly like a production connection pool.
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

/**
 * Bootstraps the `public.tenants` registry table (mirrors the migration DDL,
 * including the BAC-3 `1752019200000_add-tenant-onboarding-fields` follow-up
 * migration: `name`/`plan` columns and the `pending` status).
 */
export async function createTenantsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE public.tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'inactive')),
      schema_name TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
