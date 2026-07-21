"use client";

import { useState } from "react";
import type {
  AppointmentSummary,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from "@hep/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequirePermission } from "@/src/components/auth/RequirePermission";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { useDaySchedule } from "./hooks/useDaySchedule";
import { useBookAppointment } from "./hooks/useBookAppointment";
import { useUpdateAppointment } from "./hooks/useUpdateAppointment";
import { canManageAnyProvidersSchedule, resolveOwnProviderId } from "./providerScope";
import { AppointmentBookingForm } from "./components/AppointmentBookingForm";
import { DayScheduleTable } from "./components/DayScheduleTable";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SchedulePageProps {
  /**
   * BAC-47: set when navigating here from the visit-intake queue's "Book
   * appointment" link (`/appointments?patientId=...&patientName=...`) --
   * forwarded straight through to `AppointmentBookingForm` so staff land
   * with that patient already found/selected.
   */
  preselectedPatientId?: string;
  preselectedPatientName?: string;
}

/** BAC-21: staff/provider appointment scheduling -- book, view the day, reschedule, and cancel. */
export function SchedulePage({
  preselectedPatientId,
  preselectedPatientName,
}: SchedulePageProps = {}) {
  return (
    <RequirePermission permission="read_appointments">
      <ScheduleContent
        preselectedPatientId={preselectedPatientId}
        preselectedPatientName={preselectedPatientName}
      />
    </RequirePermission>
  );
}

function ScheduleContent({
  preselectedPatientId,
  preselectedPatientName,
}: SchedulePageProps) {
  const { user } = useCurrentUser();
  const [date, setDate] = useState(todayIsoDate());
  const [providerIdInput, setProviderIdInput] = useState("");

  // `RequirePermission` never renders this component without a resolved
  // `user` -- see its own doc comment -- but the type is still nullable, and
  // every hook below must still run unconditionally (rules-of-hooks), so the
  // `!user` bail-out is deferred to the very end of the function instead.
  const isCrossProvider = user ? canManageAnyProvidersSchedule(user.role) : false;
  const providerId = !user
    ? undefined
    : isCrossProvider
      ? providerIdInput.trim() || undefined
      : resolveOwnProviderId(user);
  const scheduleEnabled = Boolean(providerId);

  const { data, isLoading, isError } = useDaySchedule(
    { date, providerId },
    scheduleEnabled,
  );
  const bookMutation = useBookAppointment();
  const updateMutation = useUpdateAppointment();

  if (!user) {
    return null;
  }

  function handleBook(input: CreateAppointmentRequest) {
    bookMutation.mutate(input);
  }

  function handleReschedule(id: string, input: UpdateAppointmentRequest) {
    updateMutation.mutate({ id, input });
  }

  function handleCancel(id: string) {
    updateMutation.mutate({ id, input: { action: "cancel" } });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Appointments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Book, reschedule, or cancel a provider&apos;s appointments.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Book appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <AppointmentBookingForm
              fixedProviderId={isCrossProvider ? undefined : providerId}
              preselectedPatientId={preselectedPatientId}
              preselectedPatientName={preselectedPatientName}
              onSubmit={handleBook}
              isSubmitting={bookMutation.isPending}
            />
            {bookMutation.isError && (
              <p className="mt-3 text-sm text-destructive">
                {bookMutation.error instanceof Error
                  ? bookMutation.error.message
                  : "Couldn't book this appointment. Please try again."}
              </p>
            )}
            {bookMutation.isSuccess && (
              <p className="mt-3 text-sm text-success">
                Appointment booked.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Day schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-date">Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  className="h-10"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              {isCrossProvider && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schedule-providerId">Provider ID</Label>
                  <Input
                    id="schedule-providerId"
                    className="h-10 font-mono"
                    value={providerIdInput}
                    onChange={(event) =>
                      setProviderIdInput(event.target.value)
                    }
                  />
                </div>
              )}
            </div>

            {!scheduleEnabled && (
              <p className="text-sm text-muted-foreground">
                Enter a provider ID to view their schedule.
              </p>
            )}

            {scheduleEnabled && isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading schedule…
              </p>
            )}

            {scheduleEnabled && isError && (
              <p className="text-sm text-destructive">
                Couldn&apos;t load this day&apos;s schedule. Please try again.
              </p>
            )}

            {scheduleEnabled &&
              !isLoading &&
              !isError &&
              data &&
              data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No appointments scheduled for this day.
                </p>
              )}

            {scheduleEnabled &&
              !isLoading &&
              !isError &&
              data &&
              data.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  <DayScheduleTable
                    appointments={data as AppointmentSummary[]}
                    onReschedule={handleReschedule}
                    onCancel={handleCancel}
                    isMutating={updateMutation.isPending}
                  />
                </div>
              )}

            {updateMutation.isError && (
              <p className="text-sm text-destructive">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : "Couldn't update this appointment. Please try again."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
