"use client";

import type { RegisterPatientRequest } from "@hep/shared-types";
import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useRegisterPatient } from "./hooks/useRegisterPatient";
import { RegisterPatientForm } from "./components/RegisterPatientForm";

const DENIED_DESCRIPTION =
  "You need patient-write access to register a patient. If you believe this is a mistake, contact your system administrator.";

/** BAC-17, AC1/AC3/AC4: patient registration page. */
export function RegisterPatientPage() {
  return (
    <RequirePermission
      permission="write_patient"
      deniedDescription={DENIED_DESCRIPTION}
    >
      <RegisterPatientContent />
    </RequirePermission>
  );
}

function RegisterPatientContent() {
  const mutation = useRegisterPatient();

  function handleSubmit(input: RegisterPatientRequest) {
    mutation.mutate(input);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Register a patient
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture a patient&apos;s demographics to assign them an MRN.
        </p>
      </div>

      {mutation.isSuccess && mutation.data ? (
        <div className="max-w-md rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {mutation.data.firstName} {mutation.data.lastName} was registered.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            MRN: <span className="font-mono">{mutation.data.mrn}</span>
          </p>
        </div>
      ) : (
        <>
          <RegisterPatientForm
            onSubmit={handleSubmit}
            isSubmitting={mutation.isPending}
          />

          {mutation.isError && (
            <p className="max-w-md text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Could not register this patient. Please try again."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
