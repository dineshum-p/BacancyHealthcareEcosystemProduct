"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateAppointmentRequest } from "@hep/shared-types";
import { updateAppointment } from "@/src/lib/api/schedulingApi";
import { scheduleQueryKey } from "./useDaySchedule";

export interface UpdateAppointmentInput {
  id: string;
  input: UpdateAppointmentRequest;
}

/**
 * BAC-21, AC3: reschedules or cancels an existing appointment. A successful
 * response invalidates every cached day schedule so the status/time change
 * reflects immediately, without waiting on a manual refetch.
 */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateAppointmentInput) =>
      updateAppointment(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
    },
  });
}
