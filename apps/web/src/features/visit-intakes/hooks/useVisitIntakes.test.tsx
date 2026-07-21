import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { VisitIntakeSummary } from "@hep/shared-types";
import * as visitIntakesApi from "@/src/lib/api/visitIntakesApi";
import { useVisitIntakes } from "./useVisitIntakes";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
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

describe("useVisitIntakes (BAC-47, AC2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists visit intakes filtered by status", async () => {
    vi.spyOn(visitIntakesApi, "listVisitIntakes").mockResolvedValue([INTAKE]);

    const { result } = renderHook(() => useVisitIntakes("pending"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual([INTAKE]));
    expect(visitIntakesApi.listVisitIntakes).toHaveBeenCalledWith("pending");
  });
});
