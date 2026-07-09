import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

/** Number of recovery codes issued per successful MFA activation (AC2). */
export const RECOVERY_CODE_COUNT = 10;

/**
 * Bytes of entropy per code: 16 bytes = 128 bits, formatted as 4 groups of 8
 * hex chars (XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX). This matches common
 * recovery-code entropy (e.g. GitHub-style codes) -- comfortably resistant
 * to offline brute-force even if the stored hash were ever exfiltrated,
 * while staying a human can plausibly type it if needed.
 */
const RECOVERY_CODE_BYTE_LENGTH = 16;

/**
 * Generates a batch of opaque, high-entropy, one-time recovery codes. Unlike
 * `generateRefreshToken`, these are user-facing secrets a person may need to
 * type or store long-term, so raw values are returned to the caller exactly
 * once (AC2) and only their (salted, slow-hashed -- see `hashRecoveryCode`)
 * hashes are persisted.
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
  const groups: string[] = [];
  for (let i = 0; i < hex.length; i += 8) {
    groups.push(hex.slice(i, i + 8));
  }
  return groups.join('-');
}

/**
 * Argon2 (argon2id, the library's default) hash of a recovery code, mirroring
 * `password-hasher.util.ts#hashPassword`. Unlike a refresh token (256 bits of
 * entropy, never surfaced to a human), a recovery code is a user-supplied
 * secret with far less entropy and a real (if currently unreachable, since
 * there's no redemption endpoint yet) exposure path -- so it gets the same
 * slow, per-call-salted treatment as a password rather than a bare SHA-256
 * digest, to stay resistant to offline brute-force if `mfa_recovery_codes`
 * is ever exfiltrated.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  return argon2.hash(code);
}

/**
 * Verifies a raw recovery code against a stored Argon2 hash, mirroring
 * `password-hasher.util.ts#verifyPassword`. Not yet called by production
 * code (no redemption endpoint exists -- see `mfa-recovery-codes.repository
 * .ts`), but kept alongside `hashRecoveryCode` so the hash/verify pair is
 * exercised together and ready for that future flow.
 */
export async function verifyRecoveryCode(
  hash: string,
  code: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, code);
  } catch {
    return false;
  }
}
