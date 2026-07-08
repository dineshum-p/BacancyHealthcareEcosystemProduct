import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import type { Tenant } from '../tenants/tenant.entity';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import type { RequestWithTenant } from './request-with-tenant.interface';

/**
 * Request-scoped tenant context, injectable by any controller/service
 * downstream of `TenantGuard` (AC4).
 *
 * `getSchemaBoundClient()` checks a dedicated client out of the shared pool
 * for the remainder of the request and issues `SET search_path` so the
 * connection is bound to the resolved tenant's schema (AC1). The client is
 * released back to the pool when the underlying HTTP request closes so
 * pooled connections never leak a tenant's search_path into another
 * request.
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

  /**
   * Returns a Postgres client dedicated to this request and bound to the
   * current tenant's schema via `SET search_path`. Callers should still
   * fully-qualify table names in their SQL (defense in depth / test
   * parity); `search_path` binding is the literal connection-binding
   * behaviour required by AC1.
   */
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
      // connection wasn't left in a bad state by the failed setup, and
      // never releasing at all would leak it out of the pool permanently
      // (see BAC-4 review finding).
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
