"use client";

import { useMutation } from "@tanstack/react-query";
import type { SelfRegisterPatientRequest } from "@hep/shared-types";
import { submitSelfRegistration } from "@/src/lib/api/selfRegistrationsApi";

/**
 * BAC-37: submits a patient's own public self-registration for the given
 * tenant. There is nothing to invalidate on success -- unlike
 * `useRegisterPatient` (BAC-17), this call never creates a searchable
 * `patients` row by itself (it is always `pending` until staff review it),
 * so there is no cached patient search to refresh here.
 */
export function useSubmitSelfRegistration(tenantSlug: string) {
  return useMutation({
    mutationFn: (input: SelfRegisterPatientRequest) =>
      submitSelfRegistration(tenantSlug, input),
  });
}
