export type TenantId = string;

/**
 * Roles a user can hold within a tenant (BAC-5). No role-assignment flow is
 * specified yet -- every user registered via `POST /auth/register` gets
 * `member` by default. Extend this union as role-management ships.
 */
export type UserRole = 'member';

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
