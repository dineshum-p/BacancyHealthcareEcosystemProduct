import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { MfaRecoveryCodesRepository } from './mfa-recovery-codes.repository';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { Tenant } from '../tenants/tenant.entity';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

function makeFakeTenantContext(
  pool: Pool,
  tenant: Tenant,
): TenantContextService {
  let client: PoolClient | null = null;
  return {
    getTenant: () => tenant,
    getSchemaBoundClient: async () => {
      if (!client) {
        client = await pool.connect();
        await client.query(`SET search_path TO "${tenant.schemaName}", public`);
      }
      return client;
    },
  } as unknown as TenantContextService;
}

describe('MfaRecoveryCodesRepository', () => {
  let pool: Pool;
  const tenant: Tenant = {
    id: '1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
  };
  const userId = randomUUID();

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA "tenant_acme"');
    await pool.query(`
      CREATE TABLE "tenant_acme".mfa_recovery_codes (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        code_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (code_hash)
      )
    `);
  });

  it('persists only the supplied hashes, never raw values, scoped to the tenant schema', async () => {
    const repository = new MfaRecoveryCodesRepository(
      makeFakeTenantContext(pool, tenant),
    );

    await repository.replaceAll(userId, ['hash-1', 'hash-2', 'hash-3']);

    const result = await pool.query<{ code_hash: string; user_id: string }>(
      'SELECT code_hash, user_id FROM "tenant_acme".mfa_recovery_codes ORDER BY code_hash',
    );
    expect(result.rows.map((r) => r.code_hash)).toEqual([
      'hash-1',
      'hash-2',
      'hash-3',
    ]);
    expect(result.rows.every((r) => r.user_id === userId)).toBe(true);
  });

  it('replaceAll discards any previously stored codes for that user', async () => {
    const repository = new MfaRecoveryCodesRepository(
      makeFakeTenantContext(pool, tenant),
    );
    await repository.replaceAll(userId, ['old-hash-1', 'old-hash-2']);

    await repository.replaceAll(userId, ['new-hash-1']);

    const result = await pool.query<{ code_hash: string }>(
      'SELECT code_hash FROM "tenant_acme".mfa_recovery_codes WHERE user_id = $1',
      [userId],
    );
    expect(result.rows.map((r) => r.code_hash)).toEqual(['new-hash-1']);
  });
});
