"use client";

import type { SelfRegisterPatientRequest } from "@hep/shared-types";
import { useSubmitSelfRegistration } from "./hooks/useSubmitSelfRegistration";
import { SelfRegisterForm } from "./components/SelfRegisterForm";

export interface PublicSelfRegisterPageProps {
  tenantSlug: string;
}

/**
 * BAC-37: the PUBLIC, unauthenticated patient self-registration page
 * (`/:tenantSlug/register`). Deliberately NOT wrapped in `RequireRole`/
 * `RequirePermission` (unlike every other `apps/web` feature page) -- a
 * patient submitting their own registration online has no session/JWT at
 * all, by design, mirroring `services/patient`'s own public
 * `PublicPatientSelfRegistrationsController` (guarded only by `TenantGuard`/
 * `ThrottlerGuard`, deliberately never `AccessTokenGuard`). The root layout
 * imposes no auth chrome of its own, so this page needs no special
 * "unwrap the authenticated shell" handling beyond simply never rendering
 * an auth gate.
 *
 * On success, shows only a generic "pending clinic review" confirmation --
 * NEVER an MRN (an MRN is only ever assigned once staff approve the
 * submission via the review queue) and never any indication of whether
 * duplicate detection flagged a probable match: `SelfRegistrationReceipt`
 * (this mutation's response type) deliberately never carries that
 * information to the anonymous public caller in the first place (see that
 * shared type's doc comment), so this single confirmation message already
 * covers both the "new" and "possible duplicate" cases without leaking
 * anything about any other patient's record.
 */
export function PublicSelfRegisterPage({
  tenantSlug,
}: PublicSelfRegisterPageProps) {
  const mutation = useSubmitSelfRegistration(tenantSlug);

  function handleSubmit(input: SelfRegisterPatientRequest) {
    mutation.mutate(input);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Register as a patient
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us a little about yourself. Our clinic staff will review your
          submission before your first visit.
        </p>
      </div>

      {mutation.isSuccess ? (
        <div className="max-w-md rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            Thanks — your registration has been submitted.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            It is pending clinic review. If we already have a similar record
            on file, our staff will follow up with you directly.
          </p>
        </div>
      ) : (
        <>
          <SelfRegisterForm
            onSubmit={handleSubmit}
            isSubmitting={mutation.isPending}
          />

          {mutation.isError && (
            <p className="max-w-md text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Could not submit your registration. Please try again."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
