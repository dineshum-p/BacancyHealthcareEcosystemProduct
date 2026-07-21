"use client";

import type { UpsertPatientProfileRequest } from "@hep/shared-types";
import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { ForbiddenView } from "@/src/components/auth/ForbiddenView";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { isForbiddenError } from "@/src/lib/api/apiError";
import { usePatientProfile } from "./hooks/usePatientProfile";
import { useUpdatePatientProfile } from "./hooks/useUpdatePatientProfile";
import { PatientProfileForm } from "./components/PatientProfileForm";

const DENIED_DESCRIPTION =
  "My Profile is only available to patient accounts. If you believe this is a mistake, contact your system administrator.";

/**
 * BAC-46: "My Profile" -- the logged-in patient's own baseline health
 * profile (allergies, chronic conditions, long-term medications, plus
 * read-only demographics), view + edit. Gated by `read_patient_profile`
 * (added to `patient` alone in `rolePermissions.ts` by this ticket) via the
 * same `RequirePermission`/`ForbiddenView` pattern every other permission
 * -gated page in this app already uses.
 */
export function PatientProfilePage() {
  return (
    <RequirePermission
      permission="read_patient_profile"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <PatientProfileContent />
    </RequirePermission>
  );
}

/**
 * `RequirePermission` only renders this once `useCurrentUser` has resolved a
 * signed-in user (otherwise it renders `ForbiddenView`/`null` itself), so
 * `user` is always non-null here.
 */
function PatientProfileContent() {
  const { user } = useCurrentUser();
  const patientId = user!.userId;

  const { data, isLoading, isError, error } = usePatientProfile(patientId);
  const mutation = useUpdatePatientProfile(patientId);

  function handleSubmit(input: UpsertPatientProfileRequest) {
    mutation.mutate(input);
  }

  /**
   * BAC-46, AC3: a `patient` caller only ever reaches THEIR OWN `patientId`
   * (derived above, never from a URL param), so `services/emr`'s
   * `assertPatientScope` should never actually 403 this fetch in normal use
   * -- this branch exists for defense-in-depth (e.g. the API contract
   * changing, or this component being misused/reused with a foreign id
   * later) so a denial renders the same `ForbiddenView` every other 403 in
   * this app does, never a raw error dump or blank screen. A 403 surfaced by
   * the SAVE mutation instead of the initial fetch is treated identically.
   */
  if (isForbiddenError(error) || isForbiddenError(mutation.error)) {
    return <ForbiddenView description={DENIED_DESCRIPTION} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your allergies, chronic conditions, and long-term medications, kept
          up to date for your care team.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          Loading your profile…
        </p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load your profile. Please try again.
        </p>
      )}

      {!isLoading && !isError && data && (
        <div className="flex max-w-3xl flex-col gap-6">
          {!data.hasProfile && (
            <div className="rounded-lg border border-border/70 bg-accent/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Welcome! You haven&apos;t added your health profile yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fill in your allergies, chronic conditions, and long-term
                medications below so your care team has them on file.
              </p>
            </div>
          )}

          {mutation.isSuccess && (
            <p className="text-sm font-medium text-success">
              Profile saved.
            </p>
          )}

          <PatientProfileForm
            key={data.updatedAt ?? "new"}
            profile={mutation.data ?? data}
            onSubmit={handleSubmit}
            isSubmitting={mutation.isPending}
          />

          {mutation.isError && !isForbiddenError(mutation.error) && (
            <p className="text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Couldn't save your profile. Please try again."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
