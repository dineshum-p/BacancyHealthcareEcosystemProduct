/**
 * MFA lifecycle for a user (BAC-6):
 * - `NONE`: default; no MFA enrolled, login never challenges for a code.
 * - `PENDING`: `POST /auth/mfa/enroll` generated a secret but it has not
 *   been verified yet -- MFA is NOT enforced at login in this state.
 * - `ACTIVE`: `POST /auth/mfa/verify` confirmed a valid code against the
 *   pending secret; `POST /auth/login` now requires a TOTP code (AC3).
 */
export enum MfaStatus {
  NONE = 'none',
  PENDING = 'pending',
  ACTIVE = 'active',
}
