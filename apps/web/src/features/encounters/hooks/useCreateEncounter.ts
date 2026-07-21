"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateEncounterRequest } from "@hep/shared-types";
import { createEncounter } from "@/src/lib/api/encountersApi";
import { encountersQueryKey } from "./useEncounterHistory";

/**
 * BAC-20, AC1/AC3: submits a signed SOAP note (plus optional vitals/
 * allergies) for `patientId`. A successful response (the created
 * `EncounterSummary`) invalidates this patient's cached encounter history so
 * it reappears there immediately (AC1's "the note appears in encounter
 * history"). A failed submission (e.g. an out-of-range vital rejected by the
 * API, AC3) simply rejects -- the caller keeps the form's already-entered
 * values in place, mirroring `useRegisterPatient`'s same convention.
 */
export function useCreateEncounter(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEncounterRequest) =>
      createEncounter(patientId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: encountersQueryKey(patientId),
      });
    },
  });
}
