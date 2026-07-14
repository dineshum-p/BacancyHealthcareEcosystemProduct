import type { AuthTokens } from "@hep/shared-types";
import {
  decodeAccessToken,
  setStoredAccessToken,
  setStoredRefreshToken,
} from "@/src/lib/auth/session";
import { resolveDashboardPath } from "@/src/lib/auth/dashboardPath";

/**
 * BAC-13, AC1/AC2/AC4: persists the tokens issued by a completed login
 * (whether direct or after an MFA challenge) and resolves where to send the
 * caller next. Falls back to `staff`'s destination if the freshly issued
 * access token somehow fails to decode -- never expected in practice
 * (`services/auth` always signs a well-formed token), but `decodeAccessToken`
 * is intentionally total/never-throwing, so this stays total too rather
 * than crashing the login flow on an unexpected token shape.
 */
export function completeLogin(tokens: AuthTokens): string {
  setStoredAccessToken(tokens.accessToken);
  setStoredRefreshToken(tokens.refreshToken);
  const claims = decodeAccessToken(tokens.accessToken);
  return resolveDashboardPath(claims?.role ?? "staff");
}
