import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { getAuthConfig } from '../config/auth.config';

/**
 * A TOTP secret is NOT like a password or refresh token: `AuthService` must
 * be able to recover the raw secret at verify time to compute the expected
 * 6-digit code, so it cannot be one-way hashed (argon2/SHA-256). AES-256-GCM
 * is used instead -- symmetric, authenticated (tamper-evident) encryption,
 * keyed by `MFA_ENCRYPTION_KEY` (see `getAuthConfig`'s fail-fast guard).
 *
 * The raw secret and the decrypted value must never be logged anywhere in
 * this module or its callers.
 */
const ALGORITHM = 'aes-256-gcm';
/** Standard GCM IV length; 96 bits is the size the GCM spec recommends. */
const IV_LENGTH_BYTES = 12;

/**
 * `MFA_ENCRYPTION_KEY` is an operator-supplied string of arbitrary length
 * (like `JWT_ACCESS_SECRET`), not necessarily 32 raw bytes. SHA-256-hashing
 * it deterministically derives exactly the 32-byte key AES-256-GCM requires,
 * the same "accept any string, derive a fixed-size key" convenience
 * `JWT_ACCESS_SECRET` gets for free from HMAC.
 */
function deriveKey(rawKey: string): Buffer {
  return createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a raw (base32) TOTP secret for storage in
 * `<schema>.users.mfa_secret_encrypted`. Output is
 * `base64(iv).base64(authTag).base64(ciphertext)` -- a single persistable
 * string encoding everything `decryptTotpSecret` needs, with a fresh random
 * IV per call so encrypting the same secret twice never produces the same
 * ciphertext.
 */
export function encryptTotpSecret(rawSecret: string): string {
  const key = deriveKey(getAuthConfig().mfaEncryptionKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(rawSecret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((buffer) => buffer.toString('base64'))
    .join('.');
}

/**
 * Reverses `encryptTotpSecret`. Throws (GCM auth-tag mismatch) if the
 * ciphertext was tampered with or was encrypted under a different
 * `MFA_ENCRYPTION_KEY` -- callers must not swallow this as "invalid code".
 */
export function decryptTotpSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted TOTP secret.');
  }

  const key = deriveKey(getAuthConfig().mfaEncryptionKey);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
