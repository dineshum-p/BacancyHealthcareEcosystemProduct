"use client";

import { useState } from "react";
import type { AppointmentSummary, UpdateAppointmentRequest } from "@hep/shared-types";
import { Badge } from "@/components/ui/badge";
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

function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function datePartOf(iso: string): string {
  return iso.slice(0, 10);
}

export interface DayScheduleTableProps {
  appointments: AppointmentSummary[];
  onReschedule: (id: string, input: UpdateAppointmentRequest) => void;
  onCancel: (id: string) => void;
  isMutating: boolean;
}

/** BAC-21, AC3/AC4: one row per appointment, with inline reschedule/cancel actions for a still-booked slot. */
export function DayScheduleTable({
  appointments,
  onReschedule,
  onCancel,
  isMutating,
}: DayScheduleTableProps) {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  function handleCancel(id: string) {
    if (window.confirm("Cancel this appointment?")) {
      onCancel(id);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((appointment) => (
          <ScheduleRow
            key={appointment.id}
            appointment={appointment}
            isRescheduling={reschedulingId === appointment.id}
            isMutating={isMutating}
            onStartReschedule={() => setReschedulingId(appointment.id)}
            onCancelReschedule={() => setReschedulingId(null)}
            onSaveReschedule={(input) => {
              onReschedule(appointment.id, input);
              setReschedulingId(null);
            }}
            onCancel={() => handleCancel(appointment.id)}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface ScheduleRowProps {
  appointment: AppointmentSummary;
  isRescheduling: boolean;
  isMutating: boolean;
  onStartReschedule: () => void;
  onCancelReschedule: () => void;
  onSaveReschedule: (input: UpdateAppointmentRequest) => void;
  onCancel: () => void;
}

function ScheduleRow({
  appointment,
  isRescheduling,
  isMutating,
  onStartReschedule,
  onCancelReschedule,
  onSaveReschedule,
  onCancel,
}: ScheduleRowProps) {
  const [startTime, setStartTime] = useState(formatTime(appointment.startTime));
  const [endTime, setEndTime] = useState(formatTime(appointment.endTime));
  const isBooked = appointment.status === "booked";

  function save() {
    const date = datePartOf(appointment.startTime);
    onSaveReschedule({
      action: "reschedule",
      startTime: `${date}T${startTime}:00.000Z`,
      endTime: `${date}T${endTime}:00.000Z`,
    });
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-foreground">
          {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}
        </TableCell>
        <TableCell className="font-mono text-muted-foreground">
          {appointment.patientId}
        </TableCell>
        <TableCell>
          <Badge variant={isBooked ? "success" : "neutral"}>
            {appointment.status}
          </Badge>
        </TableCell>
        <TableCell>
          {isBooked && !isRescheduling && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isMutating}
                onClick={onStartReschedule}
              >
                Reschedule
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      {isRescheduling && (
        <TableRow>
          <TableCell colSpan={4}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`reschedule-start-${appointment.id}`}>
                  New start time
                </Label>
                <Input
                  id={`reschedule-start-${appointment.id}`}
                  type="time"
                  className="h-9"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`reschedule-end-${appointment.id}`}>
                  New end time
                </Label>
                <Input
                  id={`reschedule-end-${appointment.id}`}
                  type="time"
                  className="h-9"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
              <Button type="button" size="sm" onClick={save} disabled={isMutating}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelReschedule}
              >
                Cancel
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
