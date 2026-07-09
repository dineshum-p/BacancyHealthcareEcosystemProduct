/**
 * A row in a tenant's `<schema>.refresh_tokens` table. `tokenHash` is a
 * SHA-256 digest of the raw refresh token handed to the client -- the raw
 * token itself is never persisted (AC4), so a leaked database row cannot be
 * replayed as a refresh token without also matching the hash.
 */
export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}
