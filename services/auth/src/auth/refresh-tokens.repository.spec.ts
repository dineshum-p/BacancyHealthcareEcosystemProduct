import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { RefreshTokensRepository } from './refresh-tokens.repository';
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

describe('RefreshTokensRepository', () => {
  let pool: Pool;
  const tenant: Tenant = {
    id: '1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@example.com',
  };

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA "tenant_acme"');
    await pool.query(`
      CREATE TABLE "tenant_acme".refresh_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (token_hash)
      )
    `);
  });

  it('returns null when no refresh token matches the hash', async () => {
    const repository = new RefreshTokensRepository(
      makeFakeTenantContext(pool, tenant),
    );
    await expect(
      repository.findByTokenHash('does-not-exist'),
    ).resolves.toBeNull();
  });

  it('creates and finds a refresh token by its hash', async () => {
    const repository = new RefreshTokensRepository(
      makeFakeTenantContext(pool, tenant),
    );
    const userId = randomUUID();
    const expiresAt = new Date(Date.now() + 60_000);

    const created = await repository.create({
      id: randomUUID(),
      userId,
      tokenHash: 'hash-1',
      expiresAt,
    });

    expect(created).toMatchObject({
      userId,
      tokenHash: 'hash-1',
      revoked: false,
    });

    const found = await repository.findByTokenHash('hash-1');
    expect(found).toEqual(created);
  });

  it('marks a refresh token as revoked', async () => {
    const repository = new RefreshTokensRepository(
      makeFakeTenantContext(pool, tenant),
    );
    const created = await repository.create({
      id: randomUUID(),
      userId: randomUUID(),
      tokenHash: 'hash-2',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await repository.revoke(created.id);

    const found = await repository.findByTokenHash('hash-2');
    expect(found?.revoked).toBe(true);
  });
});
