"use client";

import type { CreateVisitIntakeRequest } from "@hep/shared-types";
import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useSubmitVisitIntake } from "./hooks/useSubmitVisitIntake";
import { VisitIntakeRequestForm } from "./components/VisitIntakeRequestForm";

const DENIED_DESCRIPTION =
  "Requesting a visit is only available to patient accounts. If you believe this is a mistake, contact your system administrator.";

/**
 * BAC-47, AC1: "Request a Visit" -- a logged-in patient submits their reason
 * for visit, current symptoms, and anything new since their last visit
 * ahead of being booked, then sees a clear confirmation that it's pending
 * staff review (not a silent redirect). Gated on `create_visit_intake`
 * (patient-only, self-scoped server-side), same
 * `RequirePermission`/`ForbiddenView` pattern as every other permission
 * -gated page in this app.
 */
export function RequestVisitPage() {
  return (
    <RequirePermission
      permission="create_visit_intake"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <RequestVisitContent />
    </RequirePermission>
  );
}

function RequestVisitContent() {
  const mutation = useSubmitVisitIntake();

  function handleSubmit(input: CreateVisitIntakeRequest) {
    mutation.mutate(input);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Request a visit
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us why you&apos;d like to be seen, and we&apos;ll be in touch
          to schedule your appointment.
        </p>
      </div>

      {mutation.isSuccess && mutation.data ? (
        <div className="max-w-md rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            Your request has been submitted.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            It is pending staff review -- our team will reach out to book
            your visit.
          </p>
        </div>
      ) : (
        <div className="max-w-xl">
          <VisitIntakeRequestForm
            onSubmit={handleSubmit}
            isSubmitting={mutation.isPending}
          />

          {mutation.isError && (
            <p className="mt-3 text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Couldn't submit your request. Please try again."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
