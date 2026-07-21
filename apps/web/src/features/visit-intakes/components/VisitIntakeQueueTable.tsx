"use client";

import { useState } from "react";
import Link from "next/link";
import type { LinkVisitIntakeRequest, VisitIntakeSummary } from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPatientDisplayName,
  usePatientDisplayName,
} from "../hooks/usePatientDisplayName";

export interface VisitIntakeQueueTableProps {
  intakes: VisitIntakeSummary[];
  onLink: (id: string, input: LinkVisitIntakeRequest) => void;
  isLinking: boolean;
  /** The id of the intake currently being linked, if any -- disables that row's "Mark as booked" button only. */
  linkingId: string | null;
}

/**
 * BAC-47, AC2: one row per pending visit intake -- best-effort patient name
 * (see `usePatientDisplayName`'s doc comment), reason/symptoms/what's-new,
 * a "Book appointment" link into the existing BAC-16/21 booking UI
 * pre-filled with this patient, and (this ticket's documented judgment call)
 * a "Mark as booked" mini-form that completes BAC-45's
 * `PATCH /visit-intakes/:id/link` step once staff have booked the
 * appointment.
 */
export function VisitIntakeQueueTable({
  intakes,
  onLink,
  isLinking,
  linkingId,
}: VisitIntakeQueueTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Reason for visit</TableHead>
          <TableHead>Symptoms</TableHead>
          <TableHead>What&apos;s new</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {intakes.map((intake) => (
          <IntakeRow
            key={intake.id}
            intake={intake}
            onLink={onLink}
            isLinking={isLinking && linkingId === intake.id}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface IntakeRowProps {
  intake: VisitIntakeSummary;
  onLink: (id: string, input: LinkVisitIntakeRequest) => void;
  isLinking: boolean;
}

function IntakeRow({ intake, onLink, isLinking }: IntakeRowProps) {
  const { data: profile } = usePatientDisplayName(intake.patientId);
  const [providerId, setProviderId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");

  const displayName = formatPatientDisplayName(intake.patientId, profile);
  const firstName = profile?.demographics.firstName;
  const lastName = profile?.demographics.lastName;

  const bookingParams = new URLSearchParams({ patientId: intake.patientId });
  if (firstName && lastName) {
    bookingParams.set("patientName", `${firstName} ${lastName}`);
  }

  function submitLink() {
    if (!providerId.trim() || !appointmentId.trim()) return;
    onLink(intake.id, {
      providerId: providerId.trim(),
      appointmentId: appointmentId.trim(),
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">
        {displayName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {intake.reasonForVisit}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {intake.symptoms}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {intake.whatsNewSinceLastVisit || <span>&mdash;</span>}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Link href={`/appointments?${bookingParams.toString()}`}>
            <Button type="button" size="sm" variant="outline">
              Book appointment
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <Label
              htmlFor={`providerId-${intake.id}`}
              className="text-xs text-muted-foreground"
            >
              Provider ID
            </Label>
            <Input
              id={`providerId-${intake.id}`}
              className="h-8 w-28"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`appointmentId-${intake.id}`}
              className="text-xs text-muted-foreground"
            >
              Appointment ID
            </Label>
            <Input
              id={`appointmentId-${intake.id}`}
              className="h-8 w-28"
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isLinking || !providerId.trim() || !appointmentId.trim()}
            onClick={submitLink}
          >
            {isLinking ? "Marking as booked…" : "Mark as booked"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
