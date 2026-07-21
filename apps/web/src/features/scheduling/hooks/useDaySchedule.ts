"use client";

import { useQuery } from "@tanstack/react-query";
import type { AppointmentQuery } from "@hep/shared-types";
import { getDaySchedule } from "@/src/lib/api/schedulingApi";

/** Shared query-key prefix so a successful booking/reschedule/cancel can invalidate every cached day schedule (BAC-16/BAC-21). */
export const scheduleQueryKey = ["appointments"] as const;

/**
 * BAC-21, AC4: a single calendar day's schedule. `enabled` is `false`
 * whenever a `providerId` is required but not yet supplied (`clinic_admin`/
 * `staff` before they've entered one to view) -- `SchedulePage` is the one
 * that decides when that's the case; this hook simply never fetches without
 * a query object it was given (`query` itself is never optional here).
 */
export function useDaySchedule(query: AppointmentQuery, enabled = true) {
  return useQuery({
    queryKey: [...scheduleQueryKey, "day", query] as const,
    queryFn: () => getDaySchedule(query),
    enabled,
  });
}
