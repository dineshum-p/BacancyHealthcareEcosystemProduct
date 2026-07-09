import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { RefreshToken } from './refresh-token.entity';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

interface NewRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Data access for a tenant's `<schema>.refresh_tokens` table -- the
 * persistence AC4 requires so refresh tokens can be revoked/expired
 * server-side rather than being pure stateless JWTs.
 */
@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(entry: NewRefreshToken): Promise<RefreshToken> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<RefreshTokenRow> = await client.query(
      `INSERT INTO ${schema}.refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, token_hash, expires_at, revoked, created_at`,
      [entry.id, entry.userId, entry.tokenHash, entry.expiresAt],
    );
    return this.toEntity(result.rows[0]);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    const result: QueryResult<RefreshTokenRow> = await client.query(
      `SELECT id, user_id, token_hash, expires_at, revoked, created_at
       FROM ${schema}.refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /**
   * Marks a refresh token revoked (AC4's revocation mechanism). Not wired to
   * a public endpoint by this ticket -- no AC specifies a logout flow -- but
   * exercised directly in tests to prove a revoked token is rejected by
   * `POST /auth/refresh`.
   */
  async revoke(id: string): Promise<void> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );
    await client.query(
      `UPDATE ${schema}.refresh_tokens SET revoked = true WHERE id = $1`,
      [id],
    );
  }

  private toEntity(row: RefreshTokenRow): RefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revoked: row.revoked,
      createdAt: row.created_at,
    };
  }
}
