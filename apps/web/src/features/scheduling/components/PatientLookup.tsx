"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PatientSummary } from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchPatients } from "@/src/features/patients/hooks/useSearchPatients";

interface LookupFilters {
  name: string;
}

export interface PatientLookupProps {
  onSelect: (patient: PatientSummary) => void;
}

/**
 * BAC-21, AC1: finds a patient to book with, reusing BAC-17's
 * `GET /patients` search (`useSearchPatients`) rather than inventing a new
 * lookup -- exactly per this ticket's "important API note", since
 * `services/scheduling` has no way to resolve a patient's contact info
 * itself and the caller (this form) must already have it on screen.
 */
export function PatientLookup({ onSelect }: PatientLookupProps) {
  const [submittedName, setSubmittedName] = useState<string | undefined>(
    undefined,
  );
  const { register, handleSubmit } = useForm<LookupFilters>({
    defaultValues: { name: "" },
  });

  const { data, isLoading, isError } = useSearchPatients({
    name: submittedName,
    page: 1,
  });

  function search(values: LookupFilters) {
    setSubmittedName(values.name.trim() || undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => void handleSubmit(search)(event)}
        noValidate
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="lookup-patient-name">Patient name</Label>
          <Input
            id="lookup-patient-name"
            className="h-10"
            placeholder="First or last name"
            {...register("name")}
          />
        </div>
        <Button type="submit" variant="outline" className="h-10">
          Search
        </Button>
      </form>

      {submittedName && isLoading && (
        <p className="text-sm text-muted-foreground">Searching…</p>
      )}

      {submittedName && isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t search patients. Please try again.
        </p>
      )}

      {submittedName && !isLoading && !isError && data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No patients found. Try a different name.
        </p>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.items.map((patient) => (
            <li
              key={patient.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
            >
              <div className="flex flex-col text-sm">
                <span className="font-medium text-foreground">
                  {patient.lastName}, {patient.firstName}
                </span>
                <span className="text-muted-foreground">
                  MRN <span className="font-mono">{patient.mrn}</span> ·{" "}
                  {patient.phone ?? patient.email ?? "no contact on file"}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => onSelect(patient)}
              >
                Select
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
