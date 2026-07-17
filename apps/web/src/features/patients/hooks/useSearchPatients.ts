"use client";

import { useQuery } from "@tanstack/react-query";
import type { PatientSearchQuery } from "@hep/shared-types";
import { searchPatients } from "@/src/lib/api/patientsApi";

/** Shared query-key prefix so a successful registration can invalidate every cached search (BAC-17, AC1/AC2). */
export const patientsQueryKey = ["patients"] as const;

/** BAC-17, AC2: paginated patient search by name/MRN/date of birth. */
export function useSearchPatients(query: PatientSearchQuery) {
  return useQuery({
    queryKey: [...patientsQueryKey, "search", query] as const,
    queryFn: () => searchPatients(query),
  });
}
