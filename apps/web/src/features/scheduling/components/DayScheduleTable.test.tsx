import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppointmentSummary } from "@hep/shared-types";
import { DayScheduleTable } from "./DayScheduleTable";

const BOOKED: AppointmentSummary = {
  id: "appt-1",
  tenantId: "tenant-1",
  providerId: "provider-1",
  patientId: "patient-1",
  startTime: "2026-07-20T14:00:00.000Z",
  endTime: "2026-07-20T14:30:00.000Z",
  status: "booked",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

const CANCELLED: AppointmentSummary = {
  ...BOOKED,
  id: "appt-2",
  status: "cancelled",
};

describe("DayScheduleTable (AC4)", () => {
  it("renders one row per appointment with its time range and status", () => {
    render(
      <DayScheduleTable
        appointments={[BOOKED]}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
        isMutating={false}
      />,
    );

    expect(screen.getByText(/booked/i)).toBeInTheDocument();
    expect(screen.getByText(/patient-1/)).toBeInTheDocument();
  });

  it("offers Reschedule and Cancel actions for a booked appointment", () => {
    render(
      <DayScheduleTable
        appointments={[BOOKED]}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
        isMutating={false}
      />,
    );

    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("hides actions for an already-cancelled appointment", () => {
    render(
      <DayScheduleTable
        appointments={[CANCELLED]}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
        isMutating={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /reschedule/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onCancel with the appointment id after confirming", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DayScheduleTable
        appointments={[BOOKED]}
        onReschedule={vi.fn()}
        onCancel={onCancel}
        isMutating={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledWith("appt-1");
    vi.restoreAllMocks();
  });

  it("does not call onCancel if the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <DayScheduleTable
        appointments={[BOOKED]}
        onReschedule={vi.fn()}
        onCancel={onCancel}
        isMutating={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("opens an inline reschedule form and submits the new time range", async () => {
    const user = userEvent.setup();
    const onReschedule = vi.fn();

    render(
      <DayScheduleTable
        appointments={[BOOKED]}
        onReschedule={onReschedule}
        onCancel={vi.fn()}
        isMutating={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /reschedule/i }));
    const startInput = screen.getByLabelText(/new start time/i);
    const endInput = screen.getByLabelText(/new end time/i);
    await user.clear(startInput);
    await user.type(startInput, "15:00");
    await user.clear(endInput);
    await user.type(endInput, "15:30");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onReschedule).toHaveBeenCalledWith("appt-1", {
      action: "reschedule",
      startTime: "2026-07-20T15:00:00.000Z",
      endTime: "2026-07-20T15:30:00.000Z",
    });
  });
});
