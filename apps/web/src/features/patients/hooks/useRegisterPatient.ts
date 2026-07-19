"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegisterPatientRequest } from "@hep/shared-types";
import { registerPatient } from "@/src/lib/api/patientsApi";
import { patientsQueryKey } from "./useSearchPatients";

/**
 * BAC-17, AC1/AC3: submits the registration form. A successful response
 * (the created `PatientSummary`, including its assigned MRN) invalidates
 * every cached patient search so a subsequent search picks up the new
 * patient. A failed submission (e.g. a validation error from the API)
 * simply rejects -- `RegisterPatientPage` keeps the form's already-entered
 * values in place (React Hook Form only resets on an explicit `reset()`
 * call, which nothing here makes on failure), satisfying AC3's "without
 * losing entered data".
 */
export function useRegisterPatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterPatientRequest) => registerPatient(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientsQueryKey });
    },
  });
}
