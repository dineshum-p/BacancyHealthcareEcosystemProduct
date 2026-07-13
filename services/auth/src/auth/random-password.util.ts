import { randomBytes } from 'node:crypto';

/**
 * Generates a cryptographically random, high-entropy placeholder password
 * for `AuthService.seedClinicAdmin` (BAC-12). This is an invite flow, not
 * self-service registration (`POST /auth/register`) -- there is no
 * caller-chosen password to hash, and no password-reset/invite-redemption
 * endpoint exists yet in this repo (the same documented scope gap BAC-6 left
 * for MFA recovery-code redemption). The raw value is therefore never
 * logged, returned in any HTTP response, or included in the invite
 * notification; only its Argon2 hash (`hashPassword`) is ever persisted. See
 * `AuthService.seedClinicAdmin`'s doc comment for the full rationale and the
 * follow-up this leaves for a future ticket.
 */
export function generateRandomPassword(): string {
  return randomBytes(32).toString('base64url');
}
