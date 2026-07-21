"use client";

import { useMutation } from "@tanstack/react-query";
import type { PatientSignUpRequest, RegisteredUser } from "@hep/shared-types";
import { registerPatient } from "@/src/lib/api/authApi";

export interface SignUpPatientInput extends PatientSignUpRequest {
  tenantId: string;
}

/**
 * BAC-43: submits a new patient sign-up to `POST /auth/patients/register`
 * (BAC-42). Resolves to `RegisteredUser` -- there is deliberately no
 * `AuthTokens` here (see `registerPatient`'s doc comment); `PatientSignUpPage`
 * follows this up with its own `useLogin` call using the same credentials to
 * complete the sign-in.
 */
export function useSignUpPatient() {
  return useMutation<RegisteredUser, Error, SignUpPatientInput>({
    mutationFn: ({ tenantId, ...input }) => registerPatient(tenantId, input),
  });
}
