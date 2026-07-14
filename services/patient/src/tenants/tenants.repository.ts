import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { Tenant } from './tenant.entity';
import { TenantStatus } from './tenant-status.enum';

interface TenantRow {
  id: string;
  slug: string;
  status: string;
  schema_name: string;
  name: string;
  plan: string;
  owner_email: string | null;
}

/**
 * Read-only data access for the shared/public `tenants` registry table.
 * `services/patient` never provisions or mutates tenants -- that's
 * `services/tenant`'s job -- it only resolves a tenant by identifier to
 * enforce tenant scoping (reject unknown/inactive tenants) and to know which
 * schema to bind patient queries to. Mirrors `services/billing`'s/
 * `services/emr`'s `TenantsRepository` exactly.
 */
@Injectable()
export class TenantsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByIdentifier(identifier: string): Promise<Tenant | null> {
    const result: QueryResult<TenantRow> = await this.pool.query(
      'SELECT id, slug, status, schema_name, name, plan, owner_email FROM public.tenants WHERE id = $1 OR slug = $1 LIMIT 1',
      [identifier],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  async findById(id: string): Promise<Tenant | null> {
    const result: QueryResult<TenantRow> = await this.pool.query(
      'SELECT id, slug, status, schema_name, name, plan, owner_email FROM public.tenants WHERE id = $1 LIMIT 1',
      [id],
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
      ownerEmail: row.owner_email,
    };
  }
}
