"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type {
  CreateAppointmentRequest,
  NotificationChannel,
  PatientSummary,
} from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientLookup } from "./PatientLookup";

/**
 * The notify channel(s) actually usable for a given patient, derived from
 * which contact detail(s) they have on file (BAC-21's "important API
 * note": `services/scheduling` cannot look this up itself, so this form
 * must supply `notifyChannel`/`notifyTo` from the patient record already on
 * screen). Empty when the patient has neither -- booking is blocked in that
 * case (see `AppointmentBookingForm`'s render).
 */
function availableChannels(
  patient: PatientSummary,
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (patient.phone) channels.push("sms");
  if (patient.email) channels.push("email");
  return channels;
}

function contactFor(patient: PatientSummary, channel: NotificationChannel): string {
  return channel === "sms" ? (patient.phone ?? "") : (patient.email ?? "");
}

const bookingFormSchema = z.object({
  providerId: z.string().trim().min(1, "Provider ID is required"),
  date: z.string().trim().min(1, "Date is required"),
  startTime: z.string().trim().min(1, "Start time is required"),
  endTime: z.string().trim().min(1, "End time is required"),
  notifyChannel: z.enum(["sms", "email"]),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

function toIsoDateTime(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

export interface AppointmentBookingFormProps {
  /** Set for a `provider` caller (their own id) -- hides the Provider ID field entirely (BAC-21 RBAC). Omitted for `clinic_admin`/`staff`, who must supply one. */
  fixedProviderId?: string;
  onSubmit: (input: CreateAppointmentRequest) => void;
  isSubmitting: boolean;
}

/** BAC-21, AC1: books a slot for a patient with a provider on a chosen date/time. */
export function AppointmentBookingForm({
  fixedProviderId,
  onSubmit,
  isSubmitting,
}: AppointmentBookingFormProps) {
  const [patient, setPatient] = useState<PatientSummary | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      providerId: fixedProviderId ?? "",
      date: "",
      startTime: "",
      endTime: "",
      notifyChannel: "sms",
    },
  });

  function handleSelectPatient(selected: PatientSummary) {
    setPatient(selected);
    const channels = availableChannels(selected);
    if (channels.length > 0) {
      setValue("notifyChannel", channels[0]);
    }
  }

  function submit(values: BookingFormValues) {
    if (!patient) return;
    onSubmit({
      providerId: fixedProviderId ?? values.providerId,
      patientId: patient.id,
      startTime: toIsoDateTime(values.date, values.startTime),
      endTime: toIsoDateTime(values.date, values.endTime),
      notifyChannel: values.notifyChannel,
      notifyTo: contactFor(patient, values.notifyChannel),
    });
  }

  if (!patient) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Find the patient this appointment is for.
        </p>
        <PatientLookup onSelect={handleSelectPatient} />
      </div>
    );
  }

  const channels = availableChannels(patient);
  const canNotify = channels.length > 0;
  const selectedChannel = watch("notifyChannel");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
    >
      <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
        <div className="flex flex-col text-sm">
          <span className="font-medium text-foreground">
            {patient.lastName}, {patient.firstName}
          </span>
          <span className="text-muted-foreground">
            MRN <span className="font-mono">{patient.mrn}</span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPatient(null)}
        >
          Change patient
        </Button>
      </div>

      {!fixedProviderId && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-providerId">Provider ID</Label>
          <Input
            id="booking-providerId"
            className="h-10 font-mono"
            aria-invalid={Boolean(errors.providerId)}
            {...register("providerId")}
          />
          {errors.providerId && (
            <p className="text-xs text-destructive">
              {errors.providerId.message}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-date">Date</Label>
        <Input
          id="booking-date"
          type="date"
          className="h-10"
          aria-invalid={Boolean(errors.date)}
          {...register("date")}
        />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-startTime">Start time</Label>
          <Input
            id="booking-startTime"
            type="time"
            className="h-10"
            aria-invalid={Boolean(errors.startTime)}
            {...register("startTime")}
          />
          {errors.startTime && (
            <p className="text-xs text-destructive">
              {errors.startTime.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-endTime">End time</Label>
          <Input
            id="booking-endTime"
            type="time"
            className="h-10"
            aria-invalid={Boolean(errors.endTime)}
            {...register("endTime")}
          />
          {errors.endTime && (
            <p className="text-xs text-destructive">
              {errors.endTime.message}
            </p>
          )}
        </div>
      </div>

      {canNotify ? (
        <div className="flex flex-col gap-1.5">
          <Label>Send confirmation via</Label>
          <div className="flex gap-4">
            {channels.map((channel) => (
              <label
                key={channel}
                className="flex items-center gap-1.5 text-sm"
              >
                <input
                  type="radio"
                  value={channel}
                  checked={selectedChannel === channel}
                  {...register("notifyChannel")}
                />
                {channel === "sms" ? "SMS" : "Email"}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-destructive">
          This patient has no phone or email on file, so a confirmation
          can&apos;t be sent. Add a phone or email before booking.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || !canNotify}>
        {isSubmitting ? "Booking…" : "Book appointment"}
      </Button>
    </form>
  );
}
