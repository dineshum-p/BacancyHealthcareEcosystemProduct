import { createHash, randomBytes } from 'node:crypto';

/** Number of recovery codes issued per successful MFA activation (AC2). */
export const RECOVERY_CODE_COUNT = 10;

/** Bytes of entropy per code: 5 bytes = 10 hex chars, formatted XXXXX-XXXXX. */
const RECOVERY_CODE_BYTE_LENGTH = 5;

/**
 * Generates a batch of opaque, high-entropy, one-time recovery codes. Like
 * `generateRefreshToken`, these are random values compared only by hash
 * lookup (see `hashRecoveryCode`), never re-derived -- so raw values are
 * returned to the caller exactly once (AC2) and only their hashes are
 * persisted.
 */
export function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT,
): string[] {
  return Array.from({ length: count }, () => generateOneRecoveryCode());
}

function generateOneRecoveryCode(): string {
  const hex = randomBytes(RECOVERY_CODE_BYTE_LENGTH)
    .toString('hex')
    .toUpperCase();
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`;
}

/**
 * Deterministic (not salted) SHA-256 hash used purely as a lookup key for a
 * persisted recovery code, mirroring `hashRefreshToken`'s rationale: a
 * recovery code is already 40 bits of random entropy per code (well above
 * what a password needs Argon2's slow/salted verify for), and the raw code
 * is never persisted.
 */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
