"use client";

import { useMutation } from "@tanstack/react-query";
import type { AuthTokens } from "@hep/shared-types";
import { verifyMfaLogin } from "@/src/lib/api/authApi";

export interface VerifyMfaLoginInput {
  tenantId: string;
  mfaChallengeToken: string;
  totpCode: string;
}

/**
 * BAC-13, AC2: completes login by exchanging the `MfaChallenge` returned
 * from `useLogin` plus a TOTP code for real `AuthTokens` via
 * `POST /auth/mfa/login-verify`.
 */
export function useVerifyMfaLogin() {
  return useMutation<AuthTokens, Error, VerifyMfaLoginInput>({
    mutationFn: ({ tenantId, mfaChallengeToken, totpCode }) =>
      verifyMfaLogin(tenantId, { mfaChallengeToken, totpCode }),
  });
}
