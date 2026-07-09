import * as argon2 from 'argon2';

/**
 * Argon2 (argon2id, the library's default) is the OWASP-recommended choice
 * for password hashing (AC1). Each call generates its own random salt, so
 * hashing the same password twice yields different output.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/**
 * Verifies a plaintext password against a stored Argon2 hash. Returns
 * `false` instead of throwing on a malformed/foreign hash so callers never
 * need a try/catch to treat "hash doesn't match" and "hash is unreadable"
 * as anything other than "not authenticated" (AC3).
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
