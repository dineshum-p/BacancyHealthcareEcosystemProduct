"use client";

import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useSelfRegistrations } from "./hooks/useSelfRegistrations";
import {
  useApproveSelfRegistration,
  useMergeSelfRegistration,
  useRejectSelfRegistration,
} from "./hooks/useReviewSelfRegistration";
import { SelfRegistrationsQueueTable } from "./components/SelfRegistrationsQueueTable";

const DENIED_DESCRIPTION =
  "You need self-registration review access to view this queue. If you believe this is a mistake, contact your system administrator.";

/**
 * BAC-37: the staff-facing pending self-registration review queue
 * (`/patients/self-registrations`). Gated on the narrow
 * `review_patient_self_registration` permission (BAC-36) -- deliberately
 * NOT `write_patient` -- so `staff` (who lack `write_patient`, see
 * `RegisterPatientPage`) can still reach this page, while `provider` (who
 * holds `write_patient` but not this permission) cannot.
 */
export function PendingSelfRegistrationsPage() {
  return (
    <RequirePermission
      permission="review_patient_self_registration"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <PendingSelfRegistrationsContent />
    </RequirePermission>
  );
}

function PendingSelfRegistrationsContent() {
  const { data, isLoading, isError } = useSelfRegistrations("pending");
  const approve = useApproveSelfRegistration();
  const reject = useRejectSelfRegistration();
  const merge = useMergeSelfRegistration();

  const actioningId =
    (approve.isPending && (approve.variables as string | undefined)) ||
    (reject.isPending &&
      (reject.variables as { id: string } | undefined)?.id) ||
    (merge.isPending &&
      (merge.variables as { id: string } | undefined)?.id) ||
    null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Pending self-registrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review patients who registered themselves online before their
          first visit.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the pending queue. Please try again.
        </p>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No pending self-registrations right now.
        </p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <SelfRegistrationsQueueTable
            registrations={data}
            onApprove={(id) => approve.mutate(id)}
            onReject={(id) => reject.mutate({ id, reason: undefined })}
            onMerge={(id, targetPatientId) =>
              merge.mutate({ id, targetPatientId })
            }
            actioningId={actioningId || null}
          />
        </div>
      )}
    </div>
  );
}
