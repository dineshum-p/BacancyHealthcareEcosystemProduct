import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { UsersRepository } from './users.repository';
import { UserRole } from './user-role.enum';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
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

describe('UsersRepository', () => {
  let pool: Pool;
  const tenant: Tenant = {
    id: '1',
    slug: 'acme',
    name: 'Acme Inc',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
  };

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA "tenant_acme"');
    await pool.query(`
      CREATE TABLE "tenant_acme".users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (email)
      )
    `);
  });

  it('returns null when no user exists with that email', async () => {
    const repository = new UsersRepository(makeFakeTenantContext(pool, tenant));
    await expect(
      repository.findByEmail('nobody@example.com'),
    ).resolves.toBeNull();
  });

  it('creates and finds a user by email, scoped to the tenant schema', async () => {
    const repository = new UsersRepository(makeFakeTenantContext(pool, tenant));
    const id = randomUUID();

    const created = await repository.create({
      id,
      email: 'ada@example.com',
      passwordHash: 'argon2-hash',
      role: UserRole.MEMBER,
    });

    expect(created).toMatchObject({
      id,
      email: 'ada@example.com',
      passwordHash: 'argon2-hash',
      role: UserRole.MEMBER,
    });

    const found = await repository.findByEmail('ada@example.com');
    expect(found).toEqual(created);
  });

  it('finds a user by id', async () => {
    const repository = new UsersRepository(makeFakeTenantContext(pool, tenant));
    const created = await repository.create({
      id: randomUUID(),
      email: 'ada@example.com',
      passwordHash: 'argon2-hash',
      role: UserRole.MEMBER,
    });

    await expect(repository.findById(created.id)).resolves.toEqual(created);
  });

  it('returns null when finding by an unknown id', async () => {
    const repository = new UsersRepository(makeFakeTenantContext(pool, tenant));
    await expect(repository.findById(randomUUID())).resolves.toBeNull();
  });

  it('translates a duplicate email into EmailAlreadyExistsError', async () => {
    const repository = new UsersRepository(makeFakeTenantContext(pool, tenant));
    await repository.create({
      id: randomUUID(),
      email: 'ada@example.com',
      passwordHash: 'argon2-hash',
      role: UserRole.MEMBER,
    });

    await expect(
      repository.create({
        id: randomUUID(),
        email: 'ada@example.com',
        passwordHash: 'another-hash',
        role: UserRole.MEMBER,
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });
});
