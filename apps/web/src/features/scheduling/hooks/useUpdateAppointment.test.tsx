import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppointmentSummary } from "@hep/shared-types";
import * as schedulingApi from "@/src/lib/api/schedulingApi";
import { useUpdateAppointment } from "./useUpdateAppointment";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const APPOINTMENT: AppointmentSummary = {
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

function Probe() {
  const mutation = useUpdateAppointment();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({ id: "appt-1", input: { action: "cancel" } })
        }
      >
        cancel
      </button>
      {mutation.isPending && <div>updating</div>}
      {mutation.isSuccess && <div>status:{mutation.data.status}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useUpdateAppointment (AC3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls updateAppointment with the id and action, and exposes the updated appointment", async () => {
    vi.spyOn(schedulingApi, "updateAppointment").mockResolvedValue({
      ...APPOINTMENT,
      status: "cancelled",
    });

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("cancel"));

    expect(await screen.findByText("status:cancelled")).toBeInTheDocument();
    expect(schedulingApi.updateAppointment).toHaveBeenCalledWith("appt-1", {
      action: "cancel",
    });
  });

  it("surfaces an update failure (e.g. already cancelled, or a lost race)", async () => {
    vi.spyOn(schedulingApi, "updateAppointment").mockRejectedValue(
      new Error("This appointment has already been cancelled."),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("cancel"));

    expect(
      await screen.findByText(/already been cancelled/i),
    ).toBeInTheDocument();
  });
});
