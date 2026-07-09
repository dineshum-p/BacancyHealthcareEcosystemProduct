import { UserRole } from './user-role.enum';
import { MfaStatus } from './mfa-status.enum';

/**
 * A row in a tenant's `<schema>.users` table. Never log or serialize
 * `passwordHash` back to a client (see `AuthService.toRegisteredUser`), and
 * never log or serialize `mfaSecretEncrypted` or its decrypted value either
 * (BAC-6).
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  /** MFA lifecycle state (BAC-6); see `MfaStatus`. */
  mfaStatus: MfaStatus;
  /**
   * AES-256-GCM-encrypted TOTP secret (see `totp-secret-cipher.util.ts`),
   * or `null` before enrollment ever started. Reversible by design -- never
   * a hash -- so `AuthService` can decrypt and verify a submitted code.
   */
  mfaSecretEncrypted: string | null;
  /**
   * The last TOTP time-step (see `totp.util.ts#currentTotpStep`) that was
   * successfully consumed for this user, or `null` if none yet. AC4's
   * replay-prevention floor: a code matching this step or earlier is
   * rejected even if otherwise valid.
   */
  mfaLastUsedStep: number | null;
}
