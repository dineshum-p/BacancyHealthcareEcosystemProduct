"use client";

import { useQuery } from "@tanstack/react-query";
import type { PatientProfileResponse } from "@hep/shared-types";
import { getMyPatientProfile } from "@/src/lib/api/patientProfileApi";

/**
 * BAC-47, AC2's documented judgment call: `VisitIntakeSummary` carries a
 * `patientId` but no name/demographics (BAC-44's known, already-accepted
 * cross-service limitation) -- but `services/emr`'s
 * `GET /patients/:patientId/profile` (BAC-44) already returns
 * `demographics.firstName`/`lastName` for EVERY staff-side caller (not just
 * a `patient` reading their own), since `role-permissions.map.ts` grants
 * `READ_PATIENT_PROFILE` to `super_admin`/`clinic_admin`/`provider`/`staff`
 * alike, with only a `patient` caller's read narrowed to their own record
 * (`assertPatientScope`). Reusing `getMyPatientProfile` here (the exact same
 * endpoint `PatientProfilePage`, BAC-46, already calls for a patient's own
 * id) resolves a per-row display name in the staff queue WITHOUT a new
 * endpoint or a parallel API client -- one query per row is an accepted,
 * bounded N+1 (the pending queue is not expected to be large), not the
 * "unwieldy" cross-service reconciliation this ticket's brief calls out of
 * scope; a per-row failure (403/network) degrades to
 * {@link formatPatientDisplayName}'s fallback rather than breaking the row.
 */
export function usePatientDisplayName(patientId: string) {
  return useQuery({
    queryKey: ["visit-intake-patient-display-name", patientId] as const,
    queryFn: () => getMyPatientProfile(patientId),
    retry: false,
  });
}

/**
 * "Last, First" when both names are on file; otherwise the patient id with a
 * visually clear "(name unavailable)" marker (BAC-47's documented fallback)
 * -- covers every degraded case uniformly: no data yet, a failed fetch, an
 * `hasProfile: false` empty profile, or a profile whose demographics are
 * still `null` (e.g. never captured upstream).
 */
export function formatPatientDisplayName(
  patientId: string,
  profile: PatientProfileResponse | undefined,
): string {
  const firstName = profile?.demographics.firstName;
  const lastName = profile?.demographics.lastName;
  if (firstName && lastName) {
    return `${lastName}, ${firstName}`;
  }
  return `${patientId} (name unavailable)`;
}
