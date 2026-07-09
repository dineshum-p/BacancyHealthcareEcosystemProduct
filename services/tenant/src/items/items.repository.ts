import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { Item } from './item.entity';

interface ItemRow {
  id: number;
  name: string;
  created_at: Date;
}

/**
 * Sample tenant-scoped repository. Every query is fully-qualified with the
 * resolved tenant's schema so isolation does not silently depend on
 * `search_path` alone (defense in depth, and what makes AC3 provable with a
 * real, non-mocked SQL engine in tests).
 */
@Injectable()
export class ItemsRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findAll(): Promise<Item[]> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<ItemRow> = await client.query(
      `SELECT id, name, created_at FROM ${schema}.items ORDER BY id ASC`,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async create(name: string): Promise<Item> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<ItemRow> = await client.query(
      `INSERT INTO ${schema}.items (name) VALUES ($1) RETURNING id, name, created_at`,
      [name],
    );
    return this.toEntity(result.rows[0]);
  }

  private toEntity(row: ItemRow): Item {
    return { id: row.id, name: row.name, createdAt: row.created_at };
  }
}
