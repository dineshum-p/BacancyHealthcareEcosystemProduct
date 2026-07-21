"use client";

import type { CreateEncounterRequest } from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { roleHasPermission } from "@/src/lib/auth/rolePermissions";
import { useEncounterHistory } from "./hooks/useEncounterHistory";
import { useCreateEncounter } from "./hooks/useCreateEncounter";
import { SoapNoteForm } from "./components/SoapNoteForm";
import { EncounterHistoryList } from "./components/EncounterHistoryList";

const DENIED_DESCRIPTION =
  "You need encounter access to view this patient's chart. If you believe this is a mistake, contact your system administrator.";

export interface EncounterPageProps {
  patientId: string;
}

/**
 * BAC-20: the SOAP encounter note editor + history for one patient.
 * `read_encounter` gates the whole page (AC4: staff has no access to the
 * note editor at all, hidden entirely, same `RequirePermission`/
 * `ForbiddenView` pattern `/patients/register` already established for
 * `write_patient`). Within the page, only a caller with `write_encounter`
 * (the treating `provider`, per this ticket's RBAC) sees the note editor at
 * all; everyone else (e.g. `clinic_admin`) gets `EncounterContent`'s
 * read-only oversight view of the history.
 */
export function EncounterPage({ patientId }: EncounterPageProps) {
  return (
    <RequirePermission
      permission="read_encounter"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <EncounterContent patientId={patientId} />
    </RequirePermission>
  );
}

function EncounterContent({ patientId }: EncounterPageProps) {
  const { user } = useCurrentUser();
  const canWrite = user
    ? roleHasPermission(user.role, "write_encounter")
    : false;

  const { data, isLoading, isError } = useEncounterHistory(patientId);
  const mutation = useCreateEncounter(patientId);

  function handleSubmit(input: CreateEncounterRequest) {
    mutation.mutate(input);
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Encounter note
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canWrite
            ? "Write and sign a SOAP note for this encounter."
            : "Read-only view of this patient's encounter history."}
        </p>
      </div>

      {canWrite && (
        <div className="max-w-2xl">
          {mutation.isSuccess ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Note signed and saved. It now appears in the encounter
                history below.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => mutation.reset()}
              >
                Write another note
              </Button>
            </div>
          ) : (
            <>
              <SoapNoteForm
                onSubmit={handleSubmit}
                isSubmitting={mutation.isPending}
              />

              {mutation.isError && (
                <p className="mt-3 text-sm text-destructive">
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : "Could not save this note. Please try again."}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Encounter history
        </h2>
        <EncounterHistoryList
          encounters={data}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </div>
  );
}
