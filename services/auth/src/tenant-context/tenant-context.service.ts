import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import type { Tenant } from '../tenants/tenant.entity';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import type { RequestWithTenant } from './request-with-tenant.interface';

/**
 * Request-scoped tenant context, injectable by any repository/service
 * downstream of `TenantGuard` (mirrors `services/tenant`'s BAC-4 pattern).
 *
 * `getSchemaBoundClient()` checks a dedicated client out of the shared pool
 * for the remainder of the request and issues `SET search_path` so the
 * connection is bound to the resolved tenant's schema. Repositories still
 * fully-qualify `schema.table` in their SQL (`SET search_path` is not
 * reliable across every SQL engine used in this codebase's tests -- see
 * `pg-mem`'s documented no-op -- so this is defense in depth, not the only
 * isolation mechanism). The client is released back to the pool when the
 * underlying HTTP request closes so pooled connections never leak a
 * tenant's search_path into another request.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private client: PoolClient | null = null;
  private clientPromise: Promise<PoolClient> | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: RequestWithTenant,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  getTenant(): Tenant {
    const tenant = this.request.tenant;
    if (!tenant) {
      throw new Error(
        'Tenant context was requested before TenantGuard resolved a tenant. Protect this route with TenantGuard.',
      );
    }
    return tenant;
  }

  async getSchemaBoundClient(): Promise<PoolClient> {
    if (this.client) {
      return this.client;
    }
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }
    this.client = await this.clientPromise;
    return this.client;
  }

  private async createClient(): Promise<PoolClient> {
    const tenant = this.getTenant();
    const client = await this.pool.connect();

    try {
      const schema = quoteSchemaIdentifier(tenant.schemaName);
      await client.query(`SET search_path TO ${schema}, public`);
    } catch (error) {
      // Discard rather than return to the pool: we can't be sure the
      // connection wasn't left in a bad state by the failed setup (BAC-4
      // review finding).
      client.release(true);
      throw error;
    }

    this.request.once?.('close', () => {
      this.releaseClient();
    });

    return client;
  }

  private releaseClient(): void {
    if (this.client) {
      this.client.release();
      this.client = null;
      this.clientPromise = null;
    }
  }
}
