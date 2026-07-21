import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { MfaStatus } from './mfa-status.enum';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { toIsoDate } from './date.util';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
  mfa_status: string;
  mfa_secret_encrypted: string | null;
  mfa_last_used_step: string | number | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: Date | string | null;
}

const USER_COLUMNS =
  'id, email, password_hash, role, created_at, mfa_status, mfa_secret_encrypted, mfa_last_used_step, first_name, last_name, date_of_birth';

interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  /** BAC-42: only ever set for `role: UserRole.PATIENT` (see `User`'s doc comment). */
  firstName?: string;
  lastName?: string;
  /** ISO-8601 date (`YYYY-MM-DD`). */
  dateOfBirth?: string;
}

const POSTGRES_UNIQUE_VIOLATION = '23505';

function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const pgError = error as Error & { code?: string; constraint?: string };
  if (pgError.code !== POSTGRES_UNIQUE_VIOLATION) {
    return false;
  }
  if (pgError.constraint) {
    return pgError.constraint.includes('email');
  }
  return /\(email\)/i.test(error.message);
}

/**
 * Data access for a tenant's `<schema>.users` table. Every query is
 * fully-qualified with the resolved tenant's schema (defense in depth,
 * same pattern as `services/tenant`'s `ItemsRepository`) so isolation does
 * not silently depend on `SET search_path` alone.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findByEmail(email: string): Promise<User | null> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<UserRow> = await client.query(
      `SELECT ${USER_COLUMNS} FROM ${schema}.users WHERE email = $1 LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<UserRow> = await client.query(
      `SELECT ${USER_COLUMNS} FROM ${schema}.users WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /**
   * BAC-7 bootstrap-admin check: how many users already exist for the
   * CURRENT tenant (scoped the same way every other query here is). `0`
   * means the caller is about to register the first user for this tenant --
   * see `AuthService.register`'s doc comment for why that matters.
   */
  async count(): Promise<number> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<{ count: string }> = await client.query(
      `SELECT COUNT(*) AS count FROM ${schema}.users`,
    );
    return Number(result.rows[0].count);
  }

  async create(user: NewUser): Promise<User> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    try {
      const result: QueryResult<UserRow> = await client.query(
        `INSERT INTO ${schema}.users (id, email, password_hash, role, first_name, last_name, date_of_birth)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${USER_COLUMNS}`,
        [
          user.id,
          user.email,
          user.passwordHash,
          user.role,
          user.firstName ?? null,
          user.lastName ?? null,
          user.dateOfBirth ?? null,
        ],
      );
      return this.toEntity(result.rows[0]);
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new EmailAlreadyExistsError(user.email);
      }
      throw error;
    }
  }

  /**
   * AC1: begins (or restarts) MFA enrollment -- stores the newly generated,
   * encrypted secret and sets status to `pending`. Resets any prior
   * `mfa_last_used_step` because a fresh secret starts a fresh replay-window
   * timeline; re-enrolling (e.g. the user lost the QR code before verifying,
   * or is deliberately restarting) always overwrites whatever was pending
   * before -- no separate confirmation step is specified by this ticket.
   */
  async startMfaEnrollment(
    userId: string,
    encryptedSecret: string,
  ): Promise<void> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    await client.query(
      `UPDATE ${schema}.users
       SET mfa_status = 'pending', mfa_secret_encrypted = $2, mfa_last_used_step = NULL
       WHERE id = $1`,
      [userId, encryptedSecret],
    );
  }

  /**
   * AC2: transitions `pending` -> `active` and records the time-step the
   * activating code matched, in a single atomic UPDATE guarded by
   * `mfa_status = 'pending'` so this only ever succeeds once per
   * enrollment. Returns `false` (no row updated) if the user was not in
   * `pending` state -- callers must treat that as a failure, not silently
   * activate an already-active or never-enrolled user.
   */
  async activateMfa(userId: string, initialStep: number): Promise<boolean> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result = await client.query(
      `UPDATE ${schema}.users
       SET mfa_status = 'active', mfa_last_used_step = $2
       WHERE id = $1 AND mfa_status = 'pending'`,
      [userId, initialStep],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * AC4's replay-prevention floor, enforced atomically: only records `step`
   * (and reports success) if the user is `active` AND `step` is strictly
   * greater than whatever is currently stored (or nothing is stored yet).
   * The `WHERE` clause is re-evaluated by Postgres against the latest
   * committed row for every concurrent UPDATE targeting the same row, so of
   * two concurrent requests presenting the *same* code (same `step`), only
   * the first to commit can ever satisfy `mfa_last_used_step < $2` --
   * the second always updates zero rows and must be treated as rejected.
   */
  async recordMfaStepIfNewer(userId: string, step: number): Promise<boolean> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result = await client.query(
      `UPDATE ${schema}.users
       SET mfa_last_used_step = $2
       WHERE id = $1
         AND mfa_status = 'active'
         AND (mfa_last_used_step IS NULL OR mfa_last_used_step < $2)`,
      [userId, step],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * BAC-7, AC4: persists a new role for a user already known to belong to
   * the CURRENT tenant (the caller must resolve the target user via
   * `findById` -- itself scoped to this tenant's schema -- before calling
   * this, so cross-tenant assignment is structurally impossible: a user id
   * from a different tenant simply is not a row in this schema's `users`
   * table). Returns the updated `User`, or `null` if the id no longer
   * exists in this tenant (e.g. a race with a deletion -- not currently
   * possible since there is no delete-user endpoint, but handled anyway).
   */
  async updateRole(userId: string, role: UserRole): Promise<User | null> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<UserRow> = await client.query(
      `UPDATE ${schema}.users SET role = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [userId, role],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      createdAt: row.created_at,
      mfaStatus: row.mfa_status as MfaStatus,
      mfaSecretEncrypted: row.mfa_secret_encrypted,
      mfaLastUsedStep:
        row.mfa_last_used_step === null ? null : Number(row.mfa_last_used_step),
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth:
        row.date_of_birth === null ? null : toIsoDate(row.date_of_birth),
    };
  }
}
