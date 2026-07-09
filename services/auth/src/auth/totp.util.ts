import { authenticator } from 'otplib';

/**
 * Thin wrapper around `otplib`'s `authenticator` (the standard Node
 * TOTP/HOTP library). Deliberately relies on `otplib`'s own defaults -- 30s
 * step, 6 digits, HMAC-SHA1 -- rather than overriding them: those are the
 * values every real authenticator app (Google Authenticator, Authy, etc.)
 * assumes, and the ticket explicitly calls out not to get clever with
 * non-default algorithms.
 */
const TOTP_STEP_SECONDS = 30;

/** Generates a fresh random base32 TOTP secret (AC1). */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Builds the `otpauth://` URI an authenticator app scans/imports (AC1).
 * `accountName` is the user's email; `issuer` identifies this service/tenant
 * in the app's UI.
 */
export function buildOtpauthUri(
  accountName: string,
  issuer: string,
  secret: string,
): string {
  return authenticator.keyuri(accountName, issuer, secret);
}

/**
 * The current 30-second TOTP time-step index, i.e. `floor(unixTime / 30)`.
 * Used to record "the last step a code was successfully consumed at" for
 * replay prevention (AC4) -- tracking the step index (not the raw code
 * string) correctly rejects a *recurring* code at an earlier step, since a
 * 6-digit code can legitimately repeat across non-adjacent steps.
 */
export function currentTotpStep(): number {
  return Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
}

/**
 * Verifies a submitted TOTP code against a decrypted secret. Returns the
 * absolute time-step the code matched (current step + otplib's delta), or
 * `null` if the code is invalid/out of window -- never throws for a bad
 * code, only for otplib usage errors.
 */
export function verifyTotpCode(secret: string, code: string): number | null {
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) {
    return null;
  }
  return currentTotpStep() + delta;
}
