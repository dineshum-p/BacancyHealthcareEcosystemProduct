import { newDb } from 'pg-mem';
import { Pool } from 'pg';

/**
 * A real (not mocked) SQL engine standing in for Postgres in tests that
 * don't have a docker daemon available. It executes actual SQL text via a
 * `pg`-compatible `Pool`/`Client` API, so repositories/services under test
 * run unmodified against it -- only the connection factory differs from
 * production, which points at real Postgres (see docker-compose.test.yml).
 *
 * Mirrors `services/tenant`'s `test/support/create-in-memory-pool.ts`. Own
 * copy because `services/auth` is an independently deployable app and does
 * not import TypeScript from `services/tenant`.
 *
 * pg-mem does not implement `SET search_path` (documented no-op), so all
 * schema-scoped SQL in this codebase fully-qualifies table names rather than
 * relying on it -- see `UsersRepository`/`RefreshTokensRepository`.
 */
export function createInMemoryPool(): Pool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

/**
 * Bootstraps a `public.tenants` registry table shaped like `services/tenant`'s
 * migration (the minimum columns this service's `TenantsRepository` reads).
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
