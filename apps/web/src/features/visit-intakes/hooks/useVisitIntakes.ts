"use client";

import { useQuery } from "@tanstack/react-query";
import type { VisitIntakeStatus } from "@hep/shared-types";
import { listVisitIntakes } from "@/src/lib/api/visitIntakesApi";

/** Shared query-key prefix so linking an intake can invalidate the cached queue (BAC-47). */
export const visitIntakesQueryKey = ["visit-intakes"] as const;

/** BAC-47, AC2: the staff-facing, tenant-wide pending-review triage queue -- `status: 'pending'` is the queue view. */
export function useVisitIntakes(status?: VisitIntakeStatus) {
  return useQuery({
    queryKey: [...visitIntakesQueryKey, status ?? "all"] as const,
    queryFn: () => listVisitIntakes(status),
  });
}
