import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh tokens are opaque, high-entropy random values -- NOT JWTs. AC4
 * requires them to be revocable server-side, which is straightforward with
 * an opaque token looked up by hash; a stateless JWT refresh token can never
 * be invalidated before its own expiry, which the ticket explicitly rules
 * out.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Deterministic (not salted) hash used purely as a lookup key for the
 * `refresh_tokens.token_hash` column. A plain SHA-256 digest is appropriate
 * here -- unlike a password, a refresh token is already 256 bits of random
 * entropy, so it has none of the low-entropy/brute-forceable properties
 * that make Argon2/bcrypt (with their deliberately slow, salted, non
 * -deterministic verify) necessary for passwords. The raw token itself is
 * never persisted (AC4).
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
