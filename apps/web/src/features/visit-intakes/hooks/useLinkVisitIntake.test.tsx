import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { VisitIntakeSummary } from "@hep/shared-types";
import * as visitIntakesApi from "@/src/lib/api/visitIntakesApi";
import { useLinkVisitIntake } from "./useLinkVisitIntake";
import { visitIntakesQueryKey } from "./useVisitIntakes";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidateSpy };
}

const LINKED: VisitIntakeSummary = {
  id: "intake-1",
  tenantId: "tenant-1",
  patientId: "patient-1",
  reasonForVisit: "Persistent cough",
  symptoms: "Coughing for 3 days",
  whatsNewSinceLastVisit: "",
  status: "linked",
  assignedProviderId: "provider-1",
  appointmentId: "appt-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function Probe() {
  const mutation = useLinkVisitIntake();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            id: "intake-1",
            input: { providerId: "provider-1", appointmentId: "appt-1" },
          })
        }
      >
        link
      </button>
      {mutation.isSuccess && <div>status:{mutation.data.status}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useLinkVisitIntake (BAC-47, judgment-call link step)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("links the intake and invalidates the cached queue", async () => {
    vi.spyOn(visitIntakesApi, "linkVisitIntake").mockResolvedValue(LINKED);
    const { invalidateSpy } = renderWithClient(<Probe />);

    fireEvent.click(screen.getByText("link"));

    expect(await screen.findByText("status:linked")).toBeInTheDocument();
    expect(visitIntakesApi.linkVisitIntake).toHaveBeenCalledWith("intake-1", {
      providerId: "provider-1",
      appointmentId: "appt-1",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: visitIntakesQueryKey,
    });
  });

  it("surfaces a link failure (e.g. the 400/409 from an unbooked or already-linked appointment)", async () => {
    vi.spyOn(visitIntakesApi, "linkVisitIntake").mockRejectedValue(
      new Error("This visit intake is already linked."),
    );
    renderWithClient(<Probe />);

    fireEvent.click(screen.getByText("link"));

    expect(
      await screen.findByText("This visit intake is already linked."),
    ).toBeInTheDocument();
  });
});
