import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { UsersRepository } from './users.repository';
import { UserRole } from './user-role.enum';
import { MfaStatus } from './mfa-status.enum';
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
    ownerEmail: 'owner@example.com',
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
        mfa_status TEXT NOT NULL DEFAULT 'none',
        mfa_secret_encrypted TEXT NULL,
        mfa_last_used_step BIGINT NULL,
        first_name TEXT NULL,
        last_name TEXT NULL,
        date_of_birth DATE NULL,
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
      role: UserRole.STAFF,
    });

    expect(created).toMatchObject({
      id,
      email: 'ada@example.com',
      passwordHash: 'argon2-hash',
      role: UserRole.STAFF,
      mfaStatus: MfaStatus.NONE,
      mfaSecretEncrypted: null,
      mfaLastUsedStep: null,
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
      role: UserRole.STAFF,
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
      role: UserRole.STAFF,
    });

    await expect(
      repository.create({
        id: randomUUID(),
        email: 'ada@example.com',
        passwordHash: 'another-hash',
        role: UserRole.STAFF,
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  describe('count (BAC-7 bootstrap-admin check)', () => {
    it('returns 0 for a tenant schema with no users yet', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      await expect(repository.count()).resolves.toBe(0);
    });

    it('returns the number of users created for this tenant', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      await repository.create({
        id: randomUUID(),
        email: 'ada@example.com',
        passwordHash: 'argon2-hash',
        role: UserRole.SUPER_ADMIN,
      });
      await repository.create({
        id: randomUUID(),
        email: 'grace@example.com',
        passwordHash: 'argon2-hash',
        role: UserRole.STAFF,
      });

      await expect(repository.count()).resolves.toBe(2);
    });
  });

  describe('updateRole (BAC-7, AC4)', () => {
    it('persists a new role and returns the updated user', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const created = await repository.create({
        id: randomUUID(),
        email: 'ada@example.com',
        passwordHash: 'argon2-hash',
        role: UserRole.STAFF,
      });

      const updated = await repository.updateRole(
        created.id,
        UserRole.CLINIC_ADMIN,
      );

      expect(updated).toMatchObject({
        id: created.id,
        role: UserRole.CLINIC_ADMIN,
      });
      const found = await repository.findById(created.id);
      expect(found?.role).toBe(UserRole.CLINIC_ADMIN);
    });

    it('returns null when the user id does not exist in this tenant', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );

      await expect(
        repository.updateRole(randomUUID(), UserRole.PROVIDER),
      ).resolves.toBeNull();
    });
  });

  describe('patient identity fields (BAC-42)', () => {
    it('persists firstName/lastName/dateOfBirth when creating a patient user', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );

      const created = await repository.create({
        id: randomUUID(),
        email: 'patient@example.com',
        passwordHash: 'argon2-hash',
        role: UserRole.PATIENT,
        firstName: 'Ada',
        lastName: 'Lovelace',
        dateOfBirth: '1990-05-12',
      });

      expect(created).toMatchObject({
        role: UserRole.PATIENT,
        firstName: 'Ada',
        lastName: 'Lovelace',
        dateOfBirth: '1990-05-12',
      });

      const found = await repository.findByEmail('patient@example.com');
      expect(found).toEqual(created);
    });

    it('defaults firstName/lastName/dateOfBirth to null for a non-patient registration', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );

      const created = await repository.create({
        id: randomUUID(),
        email: 'staffer@example.com',
        passwordHash: 'argon2-hash',
        role: UserRole.STAFF,
      });

      expect(created).toMatchObject({
        firstName: null,
        lastName: null,
        dateOfBirth: null,
      });
    });
  });

  describe('MFA (BAC-6)', () => {
    async function createTestUser(repository: UsersRepository) {
      return repository.create({
        id: randomUUID(),
        email: 'ada@example.com',
        passwordHash: 'argon2-hash',
        role: UserRole.STAFF,
      });
    }

    it('startMfaEnrollment sets status to pending, stores the encrypted secret, and clears any prior step', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const user = await createTestUser(repository);

      await repository.startMfaEnrollment(user.id, 'encrypted-secret-blob');

      const found = await repository.findById(user.id);
      expect(found).toMatchObject({
        mfaStatus: MfaStatus.PENDING,
        mfaSecretEncrypted: 'encrypted-secret-blob',
        mfaLastUsedStep: null,
      });
    });

    it('activateMfa transitions pending -> active and records the initial step, returning true', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const user = await createTestUser(repository);
      await repository.startMfaEnrollment(user.id, 'encrypted-secret-blob');

      const activated = await repository.activateMfa(user.id, 12345);

      expect(activated).toBe(true);
      const found = await repository.findById(user.id);
      expect(found).toMatchObject({
        mfaStatus: MfaStatus.ACTIVE,
        mfaLastUsedStep: 12345,
      });
    });

    it('activateMfa returns false and does not change state when the user is not pending', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const user = await createTestUser(repository);
      // Never enrolled -- status is still `none`.

      const activated = await repository.activateMfa(user.id, 12345);

      expect(activated).toBe(false);
      const found = await repository.findById(user.id);
      expect(found).toMatchObject({
        mfaStatus: MfaStatus.NONE,
        mfaLastUsedStep: null,
      });
    });

    it('recordMfaStepIfNewer accepts a step strictly greater than the stored one and persists it', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const user = await createTestUser(repository);
      await repository.startMfaEnrollment(user.id, 'encrypted-secret-blob');
      await repository.activateMfa(user.id, 100);

      const accepted = await repository.recordMfaStepIfNewer(user.id, 101);

      expect(accepted).toBe(true);
      const found = await repository.findById(user.id);
      expect(found?.mfaLastUsedStep).toBe(101);
    });

    it('recordMfaStepIfNewer rejects (returns false) a step at or before the stored one -- replay prevention', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const user = await createTestUser(repository);
      await repository.startMfaEnrollment(user.id, 'encrypted-secret-blob');
      await repository.activateMfa(user.id, 100);

      const sameStep = await repository.recordMfaStepIfNewer(user.id, 100);
      const earlierStep = await repository.recordMfaStepIfNewer(user.id, 99);

      expect(sameStep).toBe(false);
      expect(earlierStep).toBe(false);
      const found = await repository.findById(user.id);
      expect(found?.mfaLastUsedStep).toBe(100);
    });

    it('recordMfaStepIfNewer only lets one of two concurrent same-code requests succeed', async () => {
      const repository = new UsersRepository(
        makeFakeTenantContext(pool, tenant),
      );
      const user = await createTestUser(repository);
      await repository.startMfaEnrollment(user.id, 'encrypted-secret-blob');
      await repository.activateMfa(user.id, 100);

      const [first, second] = await Promise.all([
        repository.recordMfaStepIfNewer(user.id, 101),
        repository.recordMfaStepIfNewer(user.id, 101),
      ]);

      expect([first, second].filter(Boolean)).toHaveLength(1);
    });
  });
});
