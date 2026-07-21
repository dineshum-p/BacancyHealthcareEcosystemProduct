"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LinkVisitIntakeRequest } from "@hep/shared-types";
import { linkVisitIntake } from "@/src/lib/api/visitIntakesApi";
import { visitIntakesQueryKey } from "./useVisitIntakes";

/**
 * BAC-47's judgment-call "mark as booked" action: `PATCH
 * /visit-intakes/:id/link` had no UI trigger before this ticket. Staff use
 * this right after booking the appointment via the existing BAC-16/21
 * booking UI (see `VisitIntakeQueueTable`'s per-row form) to associate the
 * provider + appointment they just booked back onto the pending intake --
 * without this, BAC-45's provider-scoped read (`assignedProviderId`) would
 * never actually activate. On success, invalidates the cached queue so the
 * now-linked intake drops out of the `status: 'pending'` view immediately,
 * mirroring `useApproveSelfRegistration`'s exact "mutate then invalidate the
 * queue" convention.
 */
export function useLinkVisitIntake() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: LinkVisitIntakeRequest;
    }) => linkVisitIntake(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: visitIntakesQueryKey });
    },
  });
}
