import type { AccessTokenPayload } from "@hep/shared-types";

/**
 * BAC-12, AC4: this app has no login UI yet (no prior ticket built one), so
 * there is no established session mechanism to follow. This module
 * establishes the convention every future ticket needing the caller's
 * identity/role client-side should reuse: the JWT access token issued by
 * `services/auth` (BAC-5) is stored verbatim in `localStorage` under
 * {@link ACCESS_TOKEN_STORAGE_KEY}, and its claims are decoded straight from
 * the token for client-side UI decisions (e.g. `RequireRole`). This is
 * NEVER a substitute for server-side authorization -- every guarded backend
 * route independently verifies the token's signature (`AccessTokenGuard`)
 * and role (`SuperAdminGuard`); decoding here is read-only and untrusted,
 * used only to decide what to render, exactly like the payload of any JWT
 * a client holds.
 */
export const ACCESS_TOKEN_STORAGE_KEY = "hep.accessToken";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

/**
 * BAC-13: `POST /auth/login` / `POST /auth/mfa/login-verify` return a
 * refresh token (`AuthTokens.refreshToken`) alongside the access token, in
 * the same JSON response body -- there is no server-set httpOnly cookie for
 * this app to rely on instead (that would require a backend-for-frontend
 * layer, out of scope for this ticket). It is stored the exact same way as
 * the access token above, under its own key, for the same accepted-risk
 * reason spelled out in this module's top doc comment: `services/auth`'s
 * `POST /auth/refresh` independently verifies it server-side (a hashed
 * lookup against `refresh_tokens`, checking revocation/expiry -- BAC-5,
 * AC4) before ever honoring it, so holding the raw value in `localStorage`
 * grants no client-side authority by itself, exactly like the access token.
 * Nothing in this ticket's scope reads or decodes it client-side -- it is
 * opaque here, only ever forwarded verbatim to `POST /auth/refresh`.
 */
export const REFRESH_TOKEN_STORAGE_KEY = "hep.refreshToken";

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function setStoredRefreshToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredRefreshToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

/**
 * Standard JWT `exp` claim (seconds since epoch), which every access token
 * `services/auth`'s `AccessTokenService.sign` issues carries (via
 * `JwtService.sign`'s `expiresIn` option) even though it isn't part of the
 * shared `AccessTokenPayload` contract -- that type only lists the claims
 * `apps/web` actually reads for UI decisions today. Decoded here as a
 * loosely-typed sibling of the payload rather than added to
 * `AccessTokenPayload` itself, so callers who only need `userId`/`tenantId`/
 * `role` don't have to deal with an optional `exp` they never asked for.
 */
interface DecodableJwtClaims {
  exp?: number;
}

function isExpired(claims: DecodableJwtClaims): boolean {
  return typeof claims.exp === "number" && Date.now() >= claims.exp * 1000;
}

/**
 * Decodes (but does NOT verify) a JWT's payload segment. Returns `null` for
 * anything that isn't a well-formed `header.payload.signature` token with a
 * JSON payload, AND for a token whose `exp` claim has already passed --
 * callers must treat both cases as "no usable session", never throw. An
 * expired-but-decodable token is a normal real-world case (not just a test
 * artifact): without this check, `useCurrentUser`/`RequireRole` would treat a
 * caller whose session has simply timed out as still "signed in", and
 * `LoginPage`'s AC4 already-authenticated guard would bounce them away from
 * `/login` with no way to get back to a real sign-in form.
 */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  try {
    const json = decodeBase64Url(segments[1]);
    const claims = JSON.parse(json) as AccessTokenPayload & DecodableJwtClaims;
    if (isExpired(claims)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

/**
 * Decodes a base64url string using only browser-safe globals (`atob` +
 * `TextDecoder`) -- `Buffer` is a Node global and isn't reliably present in
 * a client-bundle runtime, and this decoding happens in the browser
 * whenever a real page renders.
 */
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The current caller's claims, derived from whatever token (if any) is stored. */
export function getCurrentUser(): AccessTokenPayload | null {
  const token = getStoredAccessToken();
  if (!token) {
    return null;
  }
  return decodeAccessToken(token);
}
