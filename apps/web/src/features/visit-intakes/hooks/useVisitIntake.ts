"use client";

import { useQuery } from "@tanstack/react-query";
import { getVisitIntake } from "@/src/lib/api/visitIntakesApi";

/**
 * BAC-47, AC3: the single-intake detail view. A failed fetch (most notably a
 * 403 -- see `getVisitIntake`'s `ApiError`) surfaces via TanStack Query's own
 * `error`/`isError`, letting `VisitIntakeDetailPage` branch on it the same
 * way `PatientProfilePage` already does for `usePatientProfile`.
 */
export function useVisitIntake(id: string) {
  return useQuery({
    queryKey: ["visit-intake", id] as const,
    queryFn: () => getVisitIntake(id),
  });
}
