"use client";

import { useState } from "react";
import type { PatientSelfRegistrationSummary } from "@hep/shared-types";
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

export interface SelfRegistrationsQueueTableProps {
  registrations: PatientSelfRegistrationSummary[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMerge: (id: string, targetPatientId: string) => void;
  /** The id of the entry currently being actioned, if any -- disables every action button for that row only. */
  actioningId: string | null;
}

/**
 * BAC-37: one row per pending self-registration, with the approve/reject/
 * merge review actions. `matchedPatientId`/`matchReason` (BAC-36's duplicate
 * detection) are surfaced ONLY as a generic "possible duplicate" flag --
 * never any of the matched patient's own name/MRN/demographics, which this
 * summary type doesn't even carry (`matchedPatientId` is an opaque id, not a
 * patient record) -- staff who need to compare records do so by looking the
 * candidate up separately in `/patients`.
 */
export function SelfRegistrationsQueueTable({
  registrations,
  onApprove,
  onReject,
  onMerge,
  actioningId,
}: SelfRegistrationsQueueTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Date of birth</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Flag</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registrations.map((registration) => (
          <RegistrationRow
            key={registration.id}
            registration={registration}
            onApprove={onApprove}
            onReject={onReject}
            onMerge={onMerge}
            isActioning={actioningId === registration.id}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface RegistrationRowProps {
  registration: PatientSelfRegistrationSummary;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMerge: (id: string, targetPatientId: string) => void;
  isActioning: boolean;
}

function RegistrationRow({
  registration,
  onApprove,
  onReject,
  onMerge,
  isActioning,
}: RegistrationRowProps) {
  const [targetPatientId, setTargetPatientId] = useState(
    registration.matchedPatientId ?? "",
  );

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">
        {registration.lastName}, {registration.firstName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {registration.dateOfBirth}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex flex-col">
          <span>{registration.phone ?? "—"}</span>
          <span>{registration.email ?? "—"}</span>
        </div>
      </TableCell>
      <TableCell>
        {registration.matchedPatientId ? (
          <span className="inline-flex items-center rounded-full bg-pending/15 px-2 py-0.5 text-xs font-medium text-pending">
            Possible duplicate
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isActioning}
              onClick={() => onApprove(registration.id)}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isActioning}
              onClick={() => onReject(registration.id)}
            >
              Reject
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`merge-target-${registration.id}`}
              className="sr-only"
            >
              Target patient id
            </Label>
            <Input
              id={`merge-target-${registration.id}`}
              className="h-8 w-40"
              placeholder="Target patient id"
              value={targetPatientId}
              onChange={(event) => setTargetPatientId(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isActioning || !targetPatientId}
              onClick={() => onMerge(registration.id, targetPatientId)}
            >
              Merge
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
