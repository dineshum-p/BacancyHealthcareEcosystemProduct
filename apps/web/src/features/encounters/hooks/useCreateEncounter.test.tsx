import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EncounterSummary } from "@hep/shared-types";
import * as encountersApi from "@/src/lib/api/encountersApi";
import { useCreateEncounter } from "./useCreateEncounter";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const ENCOUNTER: EncounterSummary = {
  id: "e1",
  tenantId: "tenant-1",
  patientId: "p1",
  soapNote: {
    subjective: "Patient reports headache.",
    objective: "Alert and oriented.",
    assessment: "Tension headache.",
    plan: "OTC analgesic, follow up in a week.",
  },
  vitals: { heartRate: 72 },
  allergies: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function Probe({ patientId }: { patientId: string }) {
  const mutation = useCreateEncounter(patientId);
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            soapNote: ENCOUNTER.soapNote,
            vitals: { heartRate: 72 },
          })
        }
      >
        sign
      </button>
      {mutation.isPending && <div>saving</div>}
      {mutation.isSuccess && <div>saved:{mutation.data.id}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useCreateEncounter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls createEncounter with the patientId and exposes the created encounter (AC1)", async () => {
    vi.spyOn(encountersApi, "createEncounter").mockResolvedValue(ENCOUNTER);

    renderWithClient(<Probe patientId="p1" />);
    fireEvent.click(screen.getByText("sign"));

    expect(await screen.findByText("saved:e1")).toBeInTheDocument();
    expect(encountersApi.createEncounter).toHaveBeenCalledWith("p1", {
      soapNote: ENCOUNTER.soapNote,
      vitals: { heartRate: 72 },
    });
  });

  it("surfaces a submission failure without losing entered data (AC3)", async () => {
    vi.spyOn(encountersApi, "createEncounter").mockRejectedValue(
      new Error("vitals.heartRate must not be greater than 250"),
    );

    renderWithClient(<Probe patientId="p1" />);
    fireEvent.click(screen.getByText("sign"));

    expect(
      await screen.findByText("vitals.heartRate must not be greater than 250"),
    ).toBeInTheDocument();
  });
});
