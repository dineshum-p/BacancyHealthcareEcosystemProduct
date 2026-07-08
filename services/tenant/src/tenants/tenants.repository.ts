import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { Tenant } from './tenant.entity';
import { TenantStatus } from './tenant-status.enum';
import { assertSafeSchemaName } from './schema-identifier.util';

interface TenantRow {
  id: string;
  slug: string;
  status: string;
  schema_name: string;
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
      'SELECT id, slug, status, schema_name FROM public.tenants WHERE id = $1 OR slug = $1 LIMIT 1',
      [identifier],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  async create(tenant: Tenant): Promise<Tenant> {
    // Defense-in-depth: validate at write time too, not just at usage time
    // (`quoteSchemaIdentifier`), so an unsafe/corrupted schema_name can
    // never reach the tenants table in the first place (BAC-4 review).
    assertSafeSchemaName(tenant.schemaName);
    const result: QueryResult<TenantRow> = await this.pool.query(
      `INSERT INTO public.tenants (id, slug, status, schema_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, status, schema_name`,
      [tenant.id, tenant.slug, tenant.status, tenant.schemaName],
    );
    return this.toEntity(result.rows[0]);
  }

  private toEntity(row: TenantRow): Tenant {
    return {
      id: row.id,
      slug: row.slug,
      status: row.status as TenantStatus,
      schemaName: row.schema_name,
    };
  }
}
