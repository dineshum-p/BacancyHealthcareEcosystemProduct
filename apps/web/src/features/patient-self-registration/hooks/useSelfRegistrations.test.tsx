import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientSelfRegistrationSummary } from "@hep/shared-types";
import * as selfRegistrationsApi from "@/src/lib/api/selfRegistrationsApi";
import { useSelfRegistrations } from "./useSelfRegistrations";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const SUMMARY: PatientSelfRegistrationSummary = {
  id: "reg-1",
  tenantId: "tenant-1",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: null,
  phone: null,
  email: null,
  status: "pending",
  matchedPatientId: null,
  matchReason: null,
  resultingPatientId: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useSelfRegistrations (BAC-37)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists self-registrations filtered by status", async () => {
    vi.spyOn(selfRegistrationsApi, "listSelfRegistrations").mockResolvedValue([
      SUMMARY,
    ]);

    const { result } = renderHook(() => useSelfRegistrations("pending"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual([SUMMARY]));
    expect(selfRegistrationsApi.listSelfRegistrations).toHaveBeenCalledWith(
      "pending",
    );
  });
});
