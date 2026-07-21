"use client";

import { useState } from "react";
import Link from "next/link";
import type { PatientSearchQuery } from "@hep/shared-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { roleHasPermission } from "@/src/lib/auth/rolePermissions";
import { useSearchPatients } from "./hooks/useSearchPatients";
import {
  PatientSearchForm,
  type PatientSearchFilters,
} from "./components/PatientSearchForm";
import { PatientResultsTable } from "./components/PatientResultsTable";

type Filters = Omit<PatientSearchQuery, "page" | "limit">;

function toFilters(values: PatientSearchFilters): Filters {
  return {
    ...(values.name ? { name: values.name } : {}),
    ...(values.mrn ? { mrn: values.mrn } : {}),
    ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
  };
}

/** BAC-17, AC2/AC4: patient search page. */
export function PatientSearchPage() {
  return (
    <RequirePermission permission="read_patient">
      <PatientSearchContent />
    </RequirePermission>
  );
}

function PatientSearchContent() {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);

  const { user } = useCurrentUser();
  const canRegister = user ? roleHasPermission(user.role, "write_patient") : false;
  const canReviewSelfRegistrations = user
    ? roleHasPermission(user.role, "review_patient_self_registration")
    : false;

  const query: PatientSearchQuery = { ...filters, page };
  const { data, isLoading, isError } = useSearchPatients(query);

  function handleSearch(values: PatientSearchFilters) {
    setFilters(toFilters(values));
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Find a patient
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by name, MRN, or date of birth.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* BAC-21: every role holds `read_appointments`, so this is always shown once signed in -- SchedulePage's own RequirePermission is the real enforcement. */}
          <Link
            href="/appointments"
            className={buttonVariants({ variant: "outline" })}
          >
            Appointments
          </Link>

          {/* BAC-37: hidden entirely for a caller without review_patient_self_registration (e.g. provider) -- PendingSelfRegistrationsPage's own RequirePermission is the real enforcement, this just avoids advertising an action that would 403. */}
          {canReviewSelfRegistrations && (
            <Link
              href="/patients/self-registrations"
              className={buttonVariants({ variant: "outline" })}
            >
              Pending self-registrations
            </Link>
          )}

          {/* BAC-17, AC4: hidden entirely for a caller without write_patient -- RegisterPatientPage's own RequirePermission is the real enforcement, this just avoids advertising an action that would 403. */}
          {canRegister && (
            <Link
              href="/patients/register"
              className={buttonVariants({ variant: "default" })}
            >
              Register patient
            </Link>
          )}
        </div>
      </div>

      <PatientSearchForm onSubmit={handleSearch} />

      {isLoading && (
        <p className="text-sm text-muted-foreground">Searching…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t search patients. Please try again.
        </p>
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No patients found. Try a different name, MRN, or date of birth.
        </p>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-border/70">
            <PatientResultsTable patients={data.items} />
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
