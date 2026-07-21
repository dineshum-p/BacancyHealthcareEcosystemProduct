"use client";

import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useVisitIntakes } from "./hooks/useVisitIntakes";
import { useLinkVisitIntake } from "./hooks/useLinkVisitIntake";
import { VisitIntakeQueueTable } from "./components/VisitIntakeQueueTable";

const DENIED_DESCRIPTION =
  "You need visit-intake review access to view this queue. If you believe this is a mistake, contact your system administrator.";

/**
 * BAC-47, AC2: the staff-facing pending visit-intake review queue --
 * patient/reason/symptoms/what's-new, a path into the existing BAC-16/21
 * booking UI, and the "mark as booked" link-completion step (this ticket's
 * documented judgment call). Gated on `read_visit_intake_queue` (staff-side
 * only), mirroring `PendingSelfRegistrationsPage`'s exact shape.
 */
export function VisitIntakeQueuePage() {
  return (
    <RequirePermission
      permission="read_visit_intake_queue"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <VisitIntakeQueueContent />
    </RequirePermission>
  );
}

function VisitIntakeQueueContent() {
  const { data, isLoading, isError } = useVisitIntakes("pending");
  const link = useLinkVisitIntake();

  const linkingId =
    (link.isPending && (link.variables as { id: string } | undefined)?.id) ||
    null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Visit intake queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review patients requesting a visit before their appointment is
          booked.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the pending queue. Please try again.
        </p>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No pending visit intakes right now.
        </p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <VisitIntakeQueueTable
            intakes={data}
            onLink={(id, input) => link.mutate({ id, input })}
            isLinking={link.isPending}
            linkingId={linkingId}
          />
        </div>
      )}

      {link.isError && (
        <p className="text-sm text-destructive">
          {link.error instanceof Error
            ? link.error.message
            : "Couldn't mark this intake as booked. Please try again."}
        </p>
      )}
    </div>
  );
}
