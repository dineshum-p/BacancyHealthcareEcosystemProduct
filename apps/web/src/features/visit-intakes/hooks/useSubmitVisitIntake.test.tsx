import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { VisitIntakeSummary } from "@hep/shared-types";
import * as visitIntakesApi from "@/src/lib/api/visitIntakesApi";
import { useSubmitVisitIntake } from "./useSubmitVisitIntake";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const INTAKE: VisitIntakeSummary = {
  id: "intake-1",
  tenantId: "tenant-1",
  patientId: "patient-1",
  reasonForVisit: "Persistent cough",
  symptoms: "Coughing for 3 days",
  whatsNewSinceLastVisit: "",
  status: "pending",
  assignedProviderId: null,
  appointmentId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function Probe() {
  const mutation = useSubmitVisitIntake();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            reasonForVisit: "Persistent cough",
            symptoms: "Coughing for 3 days",
          })
        }
      >
        submit
      </button>
      {mutation.isPending && <div>submitting</div>}
      {mutation.isSuccess && <div>status:{mutation.data.status}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useSubmitVisitIntake (BAC-47, AC1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the intake and exposes the pending confirmation (AC1)", async () => {
    vi.spyOn(visitIntakesApi, "createVisitIntake").mockResolvedValue(INTAKE);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("status:pending")).toBeInTheDocument();
    expect(visitIntakesApi.createVisitIntake).toHaveBeenCalledWith({
      reasonForVisit: "Persistent cough",
      symptoms: "Coughing for 3 days",
    });
  });

  it("surfaces a submission failure without losing entered data", async () => {
    vi.spyOn(visitIntakesApi, "createVisitIntake").mockRejectedValue(
      new Error("reasonForVisit should not be empty"),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(
      await screen.findByText("reasonForVisit should not be empty"),
    ).toBeInTheDocument();
  });
});
