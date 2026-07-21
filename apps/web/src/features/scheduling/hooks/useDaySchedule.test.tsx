import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppointmentSummary } from "@hep/shared-types";
import * as schedulingApi from "@/src/lib/api/schedulingApi";
import { useDaySchedule } from "./useDaySchedule";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

function Probe({ providerId }: { providerId?: string }) {
  const { data, isLoading, isError } = useDaySchedule({
    date: "2026-07-20",
    providerId,
  });
  if (isLoading) return <div>loading schedule</div>;
  if (isError) return <div>error loading schedule</div>;
  return <div>{data?.length ?? 0} appointments</div>;
}

describe("useDaySchedule (AC4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state", () => {
    vi.spyOn(schedulingApi, "getDaySchedule").mockReturnValue(
      new Promise(() => {}),
    );
    renderWithClient(<Probe providerId="provider-1" />);
    expect(screen.getByText("loading schedule")).toBeInTheDocument();
  });

  it("resolves with the fetched day schedule, passing the query through", async () => {
    vi.spyOn(schedulingApi, "getDaySchedule").mockResolvedValue([APPOINTMENT]);

    renderWithClient(<Probe providerId="provider-1" />);

    expect(await screen.findByText("1 appointments")).toBeInTheDocument();
    expect(schedulingApi.getDaySchedule).toHaveBeenCalledWith({
      date: "2026-07-20",
      providerId: "provider-1",
    });
  });

  it("renders an empty result set as zero appointments (empty state upstream)", async () => {
    vi.spyOn(schedulingApi, "getDaySchedule").mockResolvedValue([]);

    renderWithClient(<Probe providerId="provider-1" />);

    expect(await screen.findByText("0 appointments")).toBeInTheDocument();
  });

  it("surfaces a fetch failure", async () => {
    vi.spyOn(schedulingApi, "getDaySchedule").mockRejectedValue(
      new Error("boom"),
    );

    renderWithClient(<Probe providerId="provider-1" />);

    expect(
      await screen.findByText("error loading schedule"),
    ).toBeInTheDocument();
  });
});
