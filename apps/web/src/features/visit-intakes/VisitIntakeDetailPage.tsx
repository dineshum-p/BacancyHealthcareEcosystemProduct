"use client";

import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { ForbiddenView } from "@/src/components/auth/ForbiddenView";
import { isForbiddenError } from "@/src/lib/api/apiError";
import { useVisitIntake } from "./hooks/useVisitIntake";

const DENIED_DESCRIPTION =
  "You do not have access to this visit intake. If you believe this is a mistake, contact your system administrator.";

export interface VisitIntakeDetailPageProps {
  id: string;
}

/**
 * BAC-47, AC3: a single visit intake's full details. Gated on
 * `read_visit_intake` (every role that can ever read AT LEAST ONE intake --
 * the submitting patient's own, a provider's assigned one, or any staff-side
 * caller's unrestricted read); the finer, INSTANCE-level "whose intake" rule
 * is the API's own (`assertVisitIntakeReadScope`), surfaced here as a 403 --
 * a `provider` who is NOT the assigned provider for this specific intake
 * still holds `read_visit_intake` (so passes this outer gate) but gets
 * `ForbiddenView` from the inner 403 check below, mirroring
 * `PatientProfilePage`'s exact "gate at the role level, re-check the
 * instance-level 403 from the API" pattern.
 */
export function VisitIntakeDetailPage({ id }: VisitIntakeDetailPageProps) {
  return (
    <RequirePermission
      permission="read_visit_intake"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <VisitIntakeDetailContent id={id} />
    </RequirePermission>
  );
}

function VisitIntakeDetailContent({ id }: VisitIntakeDetailPageProps) {
  const { data, isLoading, isError, error } = useVisitIntake(id);

  if (isForbiddenError(error)) {
    return <ForbiddenView description={DENIED_DESCRIPTION} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Visit intake
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full details of this patient&apos;s pre-visit intake submission.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load this visit intake. Please try again.
        </p>
      )}

      {!isLoading && !isError && data && (
        <dl className="flex max-w-2xl flex-col gap-5">
          <Field label="Status" value={data.status} />
          <Field label="Reason for visit" value={data.reasonForVisit} />
          <Field label="Symptoms" value={data.symptoms} />
          <Field
            label="Anything new since last visit"
            value={data.whatsNewSinceLastVisit || "—"}
          />
          <Field
            label="Assigned provider"
            value={data.assignedProviderId ?? "Not yet linked"}
          />
          <Field
            label="Linked appointment"
            value={data.appointmentId ?? "Not yet linked"}
          />
        </dl>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
        {value}
      </dd>
    </div>
  );
}
