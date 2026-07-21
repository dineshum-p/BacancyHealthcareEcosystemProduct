"use client";

import { useQuery } from "@tanstack/react-query";
import type { PatientSelfRegistrationStatus } from "@hep/shared-types";
import { listSelfRegistrations } from "@/src/lib/api/selfRegistrationsApi";

/** Shared query-key prefix so a review action (approve/reject/merge) can invalidate the cached queue (BAC-37). */
export const selfRegistrationsQueryKey = ["patient-self-registrations"] as const;

/** BAC-37: the staff-facing review queue -- `status: 'pending'` is the pending-review queue view. */
export function useSelfRegistrations(status?: PatientSelfRegistrationStatus) {
  return useQuery({
    queryKey: [...selfRegistrationsQueryKey, status ?? "all"] as const,
    queryFn: () => listSelfRegistrations(status),
  });
}
