import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
}

interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
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
      `SELECT id, email, password_hash, role, created_at FROM ${schema}.users WHERE email = $1 LIMIT 1`,
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
      `SELECT id, email, password_hash, role, created_at FROM ${schema}.users WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  async create(user: NewUser): Promise<User> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    try {
      const result: QueryResult<UserRow> = await client.query(
        `INSERT INTO ${schema}.users (id, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, password_hash, role, created_at`,
        [user.id, user.email, user.passwordHash, user.role],
      );
      return this.toEntity(result.rows[0]);
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new EmailAlreadyExistsError(user.email);
      }
      throw error;
    }
  }

  private toEntity(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      createdAt: row.created_at,
    };
  }
}
