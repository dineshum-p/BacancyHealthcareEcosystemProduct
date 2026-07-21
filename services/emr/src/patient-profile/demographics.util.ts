import type {
  FhirPatientResource,
  PatientProfileDemographics,
} from '@hep/shared-types';

/**
 * Resolves the demographics section of `GET`/`PUT /patients/:patientId/profile`
 * (BAC-44).
 *
 * IMPORTANT, DOCUMENTED LIMITATION (read before reusing this): this ticket
 * was built on `feature/BAC-41-patient-role-rbac`, which does NOT include
 * BAC-42 (`services/auth`'s patient sign-up endpoint, still an unmerged
 * sibling branch as of this writing) -- so `services/auth`'s `users` table
 * has no `first_name`/`last_name`/`date_of_birth` columns to read on THIS
 * branch, and there is no established cross-service HTTP call in this
 * codebase for `services/emr` to fetch them from `services/auth` or
 * `services/patient` (BAC-14's canonical patient registry) even once BAC-42
 * lands -- see `EncountersController`'s own doc comment for the identical,
 * already-accepted gap ("services/emr`'s own `patients` table is NOT
 * reconciled with `services/patient`'s registry"). Rather than inventing a
 * new, fragile ad hoc HTTP call between services (explicitly out of scope
 * per this ticket's brief), demographics here are a best-effort, SAME-SERVICE
 * lookup: `services/emr`'s own BAC-10 FHIR `patients` table (the SAME table
 * `EncountersService` already reuses for its own same-schema existence
 * check), keyed by the identical `patientId`. If no FHIR `Patient` resource
 * exists for that id in this schema (a very likely case in practice, since
 * that gateway is a separate, optional record), every demographics field is
 * `null` -- not an error. Reconciling this against BAC-42/BAC-14's
 * canonical sources is left to a future ticket, exactly like
 * `EncountersController`'s own documented scope boundary.
 */
export function toPatientProfileDemographics(
  resource: FhirPatientResource | null,
): PatientProfileDemographics {
  const name = resource?.name?.[0];
  return {
    firstName: name?.given?.[0] ?? null,
    lastName: name?.family ?? null,
    dateOfBirth: resource?.birthDate ?? null,
  };
}
