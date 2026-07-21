"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveSelfRegistration,
  mergeSelfRegistration,
  rejectSelfRegistration,
} from "@/src/lib/api/selfRegistrationsApi";
import { selfRegistrationsQueryKey } from "./useSelfRegistrations";

/**
 * BAC-37: staff review actions on the pending self-registration queue.
 * Every action (approve/reject/merge) removes the entry from the PENDING
 * view -- approving additionally makes the patient searchable via
 * `/patients` (BAC-17's `patientsQueryKey`) -- but this feature only ever
 * invalidates its OWN cached queue here; `PatientSearchPage`'s own cache
 * naturally refreshes the next time that page is visited/re-queried, same
 * as any other out-of-feature cache in this app.
 */
export function useApproveSelfRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveSelfRegistration(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: selfRegistrationsQueryKey,
      });
    },
  });
}

export function useRejectSelfRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectSelfRegistration(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: selfRegistrationsQueryKey,
      });
    },
  });
}

export function useMergeSelfRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      targetPatientId,
    }: {
      id: string;
      targetPatientId: string;
    }) => mergeSelfRegistration(id, targetPatientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: selfRegistrationsQueryKey,
      });
    },
  });
}
