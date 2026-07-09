export type TenantId = string;

/**
 * Roles a user can hold within a tenant (BAC-7; replaces BAC-5's single
 * placeholder value `'member'`). Registration default (`POST /auth/register`)
 * is `'staff'` -- the least-privileged role -- EXCEPT for the very first
 * user registered for a given tenant, who is automatically assigned
 * `'super_admin'` (the bootstrap-admin resolution; see `services/auth`'s
 * `AuthService.register`). There is no separate seeding/admin-invite flow.
 */
export type UserRole = 'super_admin' | 'clinic_admin' | 'provider' | 'staff';

/**
 * Permissions checked by `services/auth`'s `PermissionsGuard` against the
 * caller's `role` claim (BAC-7). Deliberately minimal -- see
 * `services/auth`'s `permission.enum.ts` for why this is not a larger,
 * speculative catalog.
 */
export type Permission = 'manage_user_roles' | 'view_users';

/** One entry of `GET /auth/roles`'s response body (BAC-7, AC1). */
export interface RoleDefinition {
  role: UserRole;
  permissions: Permission[];
}

/**
 * Claims signed into every access-token JWT issued by `services/auth`
 * (BAC-5, AC5). Shared with `apps/web` so the frontend can type-check
 * anything it decodes from a stored access token without redefining the
 * contract on its side (per CLAUDE.md's FE/BE shared-types rule).
 */
export interface AccessTokenPayload {
  userId: string;
  tenantId: TenantId;
  role: UserRole;
}

/** Response body for `POST /auth/register` (BAC-5, AC1). */
export interface RegisteredUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/** Response body for `POST /auth/login` (BAC-5, AC2). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime, in seconds. */
  expiresIn: number;
}

/** Response body for `POST /auth/refresh` (BAC-5, AC4). */
export interface AccessTokenResponse {
  accessToken: string;
  /** Access token lifetime, in seconds. */
  expiresIn: number;
}

/**
 * MFA lifecycle for a user (BAC-6). Mirrors `services/auth`'s
 * `MfaStatus` enum: `none` (default) -> `pending` (enrolled, unverified)
 * -> `active` (enforced at login).
 */
export type MfaStatus = 'none' | 'pending' | 'active';

/** Response body for `POST /auth/mfa/enroll` (BAC-6, AC1). */
export interface MfaEnrollment {
  /** Base32 TOTP secret, shown once for manual entry into an authenticator app. */
  secret: string;
  /** `otpauth://` URI an authenticator app can scan as a QR code. */
  otpauthUrl: string;
}

/**
 * Response body for `POST /auth/mfa/verify` (BAC-6, AC2) -- activates MFA
 * and returns recovery codes. The raw codes are returned exactly ONCE, in
 * this response; the server persists only their hashes and can never
 * redisplay the raw values again.
 */
export interface MfaActivation {
  recoveryCodes: string[];
}

/**
 * Returned by `POST /auth/login` (BAC-6, AC3) instead of `AuthTokens` when
 * the account's MFA is `active`. `mfaChallengeToken` is single-purpose and
 * short-lived; exchange it (with a valid TOTP code) via
 * `POST /auth/mfa/login-verify` for real `AuthTokens`. It is NOT a bearer
 * access token and must not be sent as one.
 */
export interface MfaChallenge {
  mfaRequired: true;
  mfaChallengeToken: string;
}

/** `POST /auth/login`'s response is one of these two shapes (BAC-6, AC3). */
export type LoginResult = AuthTokens | MfaChallenge;
