"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpsertPatientProfileRequest } from "@hep/shared-types";
import { upsertMyPatientProfile } from "@/src/lib/api/patientProfileApi";
import { patientProfileQueryKey } from "./usePatientProfile";

/**
 * BAC-46, AC2: saves the patient's full baseline profile
 * (`PUT /patients/:patientId/profile`, full-replace semantics). On success,
 * invalidates this patient's cached profile query so a page reload (or any
 * other mounted consumer) refetches fresh from the API rather than the UI
 * quietly trusting its own submitted form state as the source of truth --
 * mirrors `useCreateEncounter`'s exact "mutate then invalidate" convention.
 * A failed save simply rejects, leaving the form's already-entered values in
 * place for the caller to retry.
 */
export function useUpdatePatientProfile(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertPatientProfileRequest) =>
      upsertMyPatientProfile(patientId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: patientProfileQueryKey(patientId),
      });
    },
  });
}
