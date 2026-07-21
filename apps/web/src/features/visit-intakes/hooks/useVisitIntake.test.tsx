import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { VisitIntakeSummary } from "@hep/shared-types";
import * as visitIntakesApi from "@/src/lib/api/visitIntakesApi";
import { ApiError } from "@/src/lib/api/apiError";
import { useVisitIntake } from "./useVisitIntake";

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

describe("useVisitIntake (BAC-47, AC3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches a single intake by id", async () => {
    vi.spyOn(visitIntakesApi, "getVisitIntake").mockResolvedValue(INTAKE);

    const { result } = renderHook(() => useVisitIntake("intake-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(INTAKE));
    expect(visitIntakesApi.getVisitIntake).toHaveBeenCalledWith("intake-1");
  });

  it("exposes a 403 ApiError so the page can render ForbiddenView", async () => {
    vi.spyOn(visitIntakesApi, "getVisitIntake").mockRejectedValue(
      new ApiError(403, "Only the provider assigned to this visit intake may read it."),
    );

    const { result } = renderHook(() => useVisitIntake("intake-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});
