"use client";

import { useMutation } from "@tanstack/react-query";
import type { CreateVisitIntakeRequest } from "@hep/shared-types";
import { createVisitIntake } from "@/src/lib/api/visitIntakesApi";

/**
 * BAC-47, AC1: submits the patient's own "Request a Visit" form
 * (`POST /visit-intakes`, self-scoped server-side). No cached query needs
 * invalidating -- a patient has no list view of their own past intakes in
 * this ticket's scope -- so this mirrors `useRegisterPatient`'s mutation
 * shape without its `invalidateQueries` step. A failed submission simply
 * rejects, leaving the form's already-entered values in place for the
 * caller to retry.
 */
export function useSubmitVisitIntake() {
  return useMutation({
    mutationFn: (input: CreateVisitIntakeRequest) => createVisitIntake(input),
  });
}
