import type { AuthTokens, LoginResult } from "@hep/shared-types";

/**
 * `services/auth`'s base URL (BAC-13). MUST be overridden outside local dev
 * via `NEXT_PUBLIC_AUTH_SERVICE_URL` -- the fallback below matches that
 * service's own dev-only default port (`services/auth/src/main.ts`,
 * `PORT ?? 3001`), mirroring `tenantsApi.ts`'s "dev-only fallback baked in"
 * convention.
 */
const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ?? "http://localhost:3001";

/** Reads `message` off a Nest-shaped JSON error body, falling back to the HTTP status text. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    // fall through to the generic message below
  }
  return `Request failed with status ${response.status}`;
}

/**
 * Builds the one header every unauthenticated auth route needs
 * (`TenantGuard`, BAC-5): `X-Tenant-Id`. There is no bearer token to send
 * here (that is the whole point of `login`/`mfa/login-verify` -- see
 * `AuthController`'s doc comment on why they're the only routes NOT behind
 * `AccessTokenGuard`), and this app has no subdomain-based tenant
 * resolution, so the caller must supply the tenant identifier (id or slug)
 * explicitly -- see `LoginForm`'s doc comment for where that comes from.
 */
function buildTenantHeaders(tenantId: string): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-Tenant-Id", tenantId);
  return headers;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * `POST /auth/login` (BAC-5/BAC-6, AC1/AC2/AC3): returns `AuthTokens` for
 * valid credentials on an account without active MFA, or an `MfaChallenge`
 * (`mfaRequired: true`) for one with active MFA -- see `LoginResult`'s doc
 * comment in `@hep/shared-types`. Invalid credentials reject with the
 * server's uniform 401 message.
 */
export async function login(
  tenantId: string,
  credentials: LoginCredentials,
): Promise<LoginResult> {
  const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: buildTenantHeaders(tenantId),
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as LoginResult;
}

export interface MfaLoginVerification {
  mfaChallengeToken: string;
  totpCode: string;
}

/**
 * `POST /auth/mfa/login-verify` (BAC-6, AC3/AC4): exchanges the challenge
 * token from `login()`'s `MfaChallenge` plus a valid TOTP code for real
 * `AuthTokens`. An invalid/expired challenge token or an invalid/reused code
 * both reject with the server's uniform 401 message (see `AuthService.
 * completeMfaLogin`'s doc comment for why nothing distinguishes them).
 */
export async function verifyMfaLogin(
  tenantId: string,
  input: MfaLoginVerification,
): Promise<AuthTokens> {
  const response = await fetch(`${AUTH_SERVICE_URL}/auth/mfa/login-verify`, {
    method: "POST",
    headers: buildTenantHeaders(tenantId),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as AuthTokens;
}
