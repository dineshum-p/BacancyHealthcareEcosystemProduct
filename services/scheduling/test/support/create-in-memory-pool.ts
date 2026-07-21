import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { DataType, IMemoryDb, newDb } from 'pg-mem';
import { Pool } from 'pg';

/**
 * A real (not mocked) SQL engine standing in for Postgres in tests that
 * don't have a docker daemon available. It executes actual SQL text via a
 * `pg`-compatible `Pool`/`Client` API, so repositories/services under test
 * run unmodified against it -- only the connection factory differs from
 * production, which points at real Postgres (see docker-compose.test.yml).
 *
 * Mirrors every other service's `test/support/create-in-memory-pool.ts`. Own
 * copy because `services/scheduling` is an independently deployable app and
 * does not import TypeScript from any of them.
 *
 * pg-mem does not implement `SET search_path` (documented no-op), so all
 * schema-scoped SQL in this codebase fully-qualifies table names.
 */
export function createInMemoryPool(): Pool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  registerFakePgcryptoExtension(db);
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

/**
 * Fakes just enough of real Postgres's `pgcrypto` extension --
 * `pgp_sym_encrypt`/`pgp_sym_decrypt` -- for BAC-45's column-level PHI
 * encryption (`VisitIntakesRepository`) to be exercised against this
 * in-memory stand-in. Copied verbatim from `services/emr`'s own
 * `test/support/create-in-memory-pool.ts` (BAC-44) -- see that file's doc
 * comment for the full rationale: `CREATE EXTENSION IF NOT EXISTS pgcrypto`
 * resolves against WHATEVER extension is registered under that name on the
 * underlying `pg-mem` `IMemoryDb`, and there is no real `pgcrypto` C
 * extension available to a pure-JS in-memory engine, so this registers a
 * real (NOT a pass-through/no-op), reversible AES-256-CBC implementation
 * instead -- meaningful both for a round-trip test and for a "the raw stored
 * bytes are NOT plaintext" assertion.
 *
 * Registered unconditionally (harmless/inert for every other spec that never
 * runs `CREATE EXTENSION pgcrypto`), so every `.spec.ts`/`.e2e-spec.ts` that
 * already calls `createInMemoryPool()` gets this for free.
 */
function registerFakePgcryptoExtension(db: IMemoryDb): void {
  db.registerExtension('pgcrypto', (schema) => {
    schema.registerFunction({
      name: 'pgp_sym_encrypt',
      args: [DataType.text, DataType.text],
      returns: DataType.bytea,
      implementation: (data: string, key: string) =>
        fakePgpSymEncrypt(data, key),
    });
    schema.registerFunction({
      name: 'pgp_sym_decrypt',
      args: [DataType.bytea, DataType.text],
      returns: DataType.text,
      implementation: (data: Buffer, key: string) =>
        fakePgpSymDecrypt(data, key),
    });
  });
}

/** `pgp_sym_encrypt`/`pgp_sym_decrypt` both key off a SHA-256 digest of the caller-supplied password, matching AES-256's required 32-byte key length. */
function deriveAesKey(password: string): Buffer {
  return createHash('sha256').update(password).digest();
}

function fakePgpSymEncrypt(plaintext: string, password: string): Buffer {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', deriveAesKey(password), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  // Real pgcrypto embeds everything needed to decrypt (including its own
  // salt/IV) in the returned bytea; this fake mirrors that by prepending the
  // IV to the ciphertext rather than requiring a separate out-of-band value.
  return Buffer.concat([iv, ciphertext]);
}

function fakePgpSymDecrypt(stored: Buffer, password: string): string {
  const iv = stored.subarray(0, 16);
  const ciphertext = stored.subarray(16);
  const decipher = createDecipheriv('aes-256-cbc', deriveAesKey(password), iv);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Bootstraps a `public.tenants` registry table shaped like
 * `services/tenant`'s migration (the minimum columns this service's
 * `TenantsRepository` reads).
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
      owner_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
