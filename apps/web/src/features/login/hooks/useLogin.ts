"use client";

import { useMutation } from "@tanstack/react-query";
import type { LoginResult } from "@hep/shared-types";
import { login } from "@/src/lib/api/authApi";

export interface LoginInput {
  tenantId: string;
  email: string;
  password: string;
}

/**
 * BAC-13, AC1/AC2: submits credentials to `POST /auth/login`. Resolves to
 * either `AuthTokens` (login complete) or an `MfaChallenge`
 * (`mfaRequired: true`, a TOTP step is required next) -- the caller
 * (`LoginPage`) decides which step to render based on the shape returned.
 */
export function useLogin() {
  return useMutation<LoginResult, Error, LoginInput>({
    mutationFn: ({ tenantId, email, password }) =>
      login(tenantId, { email, password }),
  });
}
