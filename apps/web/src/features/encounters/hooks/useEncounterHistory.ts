"use client";

import { useQuery } from "@tanstack/react-query";
import { listEncounters } from "@/src/lib/api/encountersApi";

/** Shared query-key prefix so a successful save can invalidate this patient's cached history (BAC-20, AC1/AC2). */
export function encountersQueryKey(patientId: string) {
  return ["encounters", patientId] as const;
}

/** BAC-20, AC2/AC3: a patient's encounter history, most recent first. */
export function useEncounterHistory(patientId: string) {
  return useQuery({
    queryKey: encountersQueryKey(patientId),
    queryFn: () => listEncounters(patientId),
  });
}
