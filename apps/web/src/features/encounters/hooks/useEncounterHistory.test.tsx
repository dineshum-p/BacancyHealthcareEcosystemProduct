import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EncounterSummary } from "@hep/shared-types";
import * as encountersApi from "@/src/lib/api/encountersApi";
import { useEncounterHistory } from "./useEncounterHistory";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe({ patientId }: { patientId: string }) {
  const { data, isLoading, isError } = useEncounterHistory(patientId);
  if (isLoading) return <div>loading encounters</div>;
  if (isError) return <div>error loading encounters</div>;
  return <div>{data?.length ?? 0} encounters</div>;
}

const ENCOUNTER: EncounterSummary = {
  id: "e1",
  tenantId: "tenant-1",
  patientId: "p1",
  soapNote: {
    subjective: "s",
    objective: "o",
    assessment: "a",
    plan: "p",
  },
  vitals: null,
  allergies: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useEncounterHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state", () => {
    vi.spyOn(encountersApi, "listEncounters").mockReturnValue(
      new Promise(() => {}),
    );
    renderWithClient(<Probe patientId="p1" />);
    expect(screen.getByText("loading encounters")).toBeInTheDocument();
  });

  it("resolves with the patient's encounter history (AC2)", async () => {
    vi.spyOn(encountersApi, "listEncounters").mockResolvedValue([ENCOUNTER]);

    renderWithClient(<Probe patientId="p1" />);

    expect(await screen.findByText("1 encounters")).toBeInTheDocument();
    expect(encountersApi.listEncounters).toHaveBeenCalledWith("p1");
  });

  it("surfaces a fetch failure", async () => {
    vi.spyOn(encountersApi, "listEncounters").mockRejectedValue(
      new Error("boom"),
    );

    renderWithClient(<Probe patientId="p1" />);

    expect(
      await screen.findByText("error loading encounters"),
    ).toBeInTheDocument();
  });
});
