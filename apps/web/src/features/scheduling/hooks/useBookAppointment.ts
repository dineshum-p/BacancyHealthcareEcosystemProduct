"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateAppointmentRequest } from "@hep/shared-types";
import { bookAppointment } from "@/src/lib/api/schedulingApi";
import { scheduleQueryKey } from "./useDaySchedule";

/**
 * BAC-21, AC1/AC2: submits the booking form. A successful response
 * invalidates every cached day schedule so the newly-booked slot appears
 * immediately (AC3's "status updates reflect immediately" applies here too).
 * A failed submission (most notably AC2's 409 double-booking conflict)
 * simply rejects -- `SchedulePage` keeps the form's already-entered values in
 * place, mirroring `useRegisterPatient`'s established convention.
 */
export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAppointmentRequest) => bookAppointment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
    },
  });
}
