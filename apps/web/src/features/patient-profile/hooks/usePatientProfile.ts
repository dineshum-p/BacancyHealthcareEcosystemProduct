"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyPatientProfile } from "@/src/lib/api/patientProfileApi";

/** Shared query-key prefix so a successful save can invalidate this patient's cached profile (BAC-46, AC2). */
export function patientProfileQueryKey(patientId: string) {
  return ["patient-profile", patientId] as const;
}

/**
 * BAC-46, AC1: the logged-in patient's own baseline profile. `patientId`
 * must already be resolved to the CALLER's own id (`PatientProfilePage`
 * derives it from `useCurrentUser`) -- this hook has no opinion on where it
 * came from, it only fetches.
 */
export function usePatientProfile(patientId: string) {
  return useQuery({
    queryKey: patientProfileQueryKey(patientId),
    queryFn: () => getMyPatientProfile(patientId),
  });
}
