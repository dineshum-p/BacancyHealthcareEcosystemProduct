import type { PatientGender } from '@hep/shared-types';
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
  /**
   * BAC-42: minimal identity fields collected at patient sign-up
   * (`POST /auth/patients/register`). `null` for every OTHER registration
   * path (`register()`/`seedClinicAdmin()`), which never collect a name or
   * date of birth -- these columns exist on the shared `users` table (not a
   * separate `patient_profiles` table) purely to avoid a second table for
   * three optional fields; `role !== 'patient'` rows simply never populate
   * them.
   */
  firstName: string | null;
  lastName: string | null;
  /** ISO-8601 date (`YYYY-MM-DD`), or `null` -- see `firstName`'s doc comment. */
  dateOfBirth: string | null;
  /**
   * BAC-48: the "core identity" fields collected when a `clinic_admin`/
   * `super_admin` creates a `provider` (doctor) account directly via
   * `POST /auth/users`. `null` for every OTHER registration path -- like
   * `firstName`/`lastName`/`dateOfBirth` above, these columns live on the
   * shared `users` table rather than a separate table purely to avoid one
   * for three optional fields.
   */
  gender: PatientGender | null;
  phone: string | null;
  address: string | null;
  /**
   * BAC-48: `true` for a `provider` account created via `POST /auth/users`
   * (a system-generated temporary password the doctor never chose) --
   * `false` for every self-service registration path, where the caller
   * already chose their own password. Enforcing an actual forced reset on
   * first login is BAC-49's (a separate ticket's) job; this column only
   * persists the flag.
   */
  mustResetPassword: boolean;
}
