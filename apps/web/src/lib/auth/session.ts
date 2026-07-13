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
 * Decodes (but does NOT verify) a JWT's payload segment. Returns `null` for
 * anything that isn't a well-formed `header.payload.signature` token with a
 * JSON payload -- callers must treat that as "no usable session", never
 * throw.
 */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  try {
    const json = decodeBase64Url(segments[1]);
    return JSON.parse(json) as AccessTokenPayload;
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
