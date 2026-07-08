import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { Tenant } from './tenant.entity';
import { TenantStatus } from './tenant-status.enum';
import { assertSafeSchemaName } from './schema-identifier.util';
import { SlugAlreadyExistsError } from './errors/slug-already-exists.error';

interface TenantRow {
  id: string;
  slug: string;
  status: string;
  schema_name: string;
  name: string;
  plan: string;
}

const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * Detects a unique-violation on the `slug` column across both the real `pg`
 * driver (which populates `.constraint`, e.g. `tenants_slug_key`) and
 * `pg-mem` (used in tests), which only composes the offending column name
 * into the error message/detail text.
 */
function isSlugUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const pgError = error as Error & { code?: string; constraint?: string };
  if (pgError.code !== POSTGRES_UNIQUE_VIOLATION) {
    return false;
  }
  if (pgError.constraint) {
    return pgError.constraint.includes('slug');
  }
  return /\(slug\)/i.test(error.message);
}

/**
 * Data access for the shared/public `tenants` registry table.
 * This is the ONLY place that reads/writes `public.tenants` directly.
 */
@Injectable()
export class TenantsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Resolves a tenant by id OR slug (a request's `X-Tenant-Id` header or a
   * subdomain slug are both accepted as the "identifier" BAC-4 must resolve).
   */
  async findByIdentifier(identifier: string): Promise<Tenant | null> {
    const result: QueryResult<TenantRow> = await this.pool.query(
      'SELECT id, slug, status, schema_name, name, plan FROM public.tenants WHERE id = $1 OR slug = $1 LIMIT 1',
      [identifier],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /** Resolves a tenant strictly by id (BAC-3's `GET /tenants/:id`). */
  async findById(id: string): Promise<Tenant | null> {
    const result: QueryResult<TenantRow> = await this.pool.query(
      'SELECT id, slug, status, schema_name, name, plan FROM public.tenants WHERE id = $1 LIMIT 1',
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  async create(tenant: Tenant): Promise<Tenant> {
    // Defense-in-depth: validate at write time too, not just at usage time
    // (`quoteSchemaIdentifier`), so an unsafe/corrupted schema_name can
    // never reach the tenants table in the first place (BAC-4 review).
    assertSafeSchemaName(tenant.schemaName);
    try {
      const result: QueryResult<TenantRow> = await this.pool.query(
        `INSERT INTO public.tenants (id, slug, status, schema_name, name, plan)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, slug, status, schema_name, name, plan`,
        [
          tenant.id,
          tenant.slug,
          tenant.status,
          tenant.schemaName,
          tenant.name,
          tenant.plan,
        ],
      );
      return this.toEntity(result.rows[0]);
    } catch (error) {
      // A pre-check-then-insert race is inherently unsafe under concurrent
      // requests; relying on the database's own unique constraint (and
      // translating the resulting error here) is what makes the 409
      // correct under concurrency (AC3).
      if (isSlugUniqueViolation(error)) {
        throw new SlugAlreadyExistsError(tenant.slug);
      }
      throw error;
    }
  }

  /**
   * Transitions a tenant to a new status (BAC-3's pending -> active
   * transition once provisioning succeeds). Returns `null` if no tenant
   * with that id exists.
   */
  async updateStatus(id: string, status: TenantStatus): Promise<Tenant | null> {
    const result: QueryResult<TenantRow> = await this.pool.query(
      `UPDATE public.tenants
       SET status = $2
       WHERE id = $1
       RETURNING id, slug, status, schema_name, name, plan`,
      [id, status],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: TenantRow): Tenant {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      plan: row.plan,
      status: row.status as TenantStatus,
      schemaName: row.schema_name,
    };
  }
}
