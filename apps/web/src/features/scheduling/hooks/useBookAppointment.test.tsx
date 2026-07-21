import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppointmentSummary } from "@hep/shared-types";
import * as schedulingApi from "@/src/lib/api/schedulingApi";
import { useBookAppointment } from "./useBookAppointment";

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
  const mutation = useBookAppointment();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            providerId: "provider-1",
            patientId: "patient-1",
            startTime: "2026-07-20T14:00:00.000Z",
            endTime: "2026-07-20T14:30:00.000Z",
            notifyChannel: "sms",
            notifyTo: "+15551234567",
          })
        }
      >
        book
      </button>
      {mutation.isPending && <div>booking</div>}
      {mutation.isSuccess && <div>booked:{mutation.data.id}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useBookAppointment (AC1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls bookAppointment and exposes the created appointment", async () => {
    vi.spyOn(schedulingApi, "bookAppointment").mockResolvedValue(APPOINTMENT);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("book"));

    expect(await screen.findByText("booked:appt-1")).toBeInTheDocument();
    expect(schedulingApi.bookAppointment).toHaveBeenCalledWith({
      providerId: "provider-1",
      patientId: "patient-1",
      startTime: "2026-07-20T14:00:00.000Z",
      endTime: "2026-07-20T14:30:00.000Z",
      notifyChannel: "sms",
      notifyTo: "+15551234567",
    });
  });

  it("surfaces a double-booking conflict without losing the mutation's input (AC2)", async () => {
    vi.spyOn(schedulingApi, "bookAppointment").mockRejectedValue(
      new Error(
        "This provider already has a booked appointment overlapping the requested slot.",
      ),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("book"));

    expect(
      await screen.findByText(/already has a booked appointment/i),
    ).toBeInTheDocument();
  });
});
