import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientProfileResponse } from "@hep/shared-types";
import * as patientProfileApi from "@/src/lib/api/patientProfileApi";
import { ApiError } from "@/src/lib/api/apiError";
import {
  formatPatientDisplayName,
  usePatientDisplayName,
} from "./usePatientDisplayName";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const PROFILE: PatientProfileResponse = {
  id: "profile-1",
  patientId: "patient-1",
  tenantId: "tenant-1",
  hasProfile: true,
  demographics: {
    firstName: "Ada",
    lastName: "Lovelace",
    dateOfBirth: "1990-01-01",
  },
  allergies: [],
  chronicConditions: [],
  medications: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("usePatientDisplayName (BAC-47, AC2 best-effort name resolution)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the patient's profile by id, reusing services/emr's profile endpoint", async () => {
    vi.spyOn(patientProfileApi, "getMyPatientProfile").mockResolvedValue(
      PROFILE,
    );

    const { result } = renderHook(() => usePatientDisplayName("patient-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(PROFILE));
    expect(patientProfileApi.getMyPatientProfile).toHaveBeenCalledWith(
      "patient-1",
    );
  });

  it("does not throw the hook into an error state on a 403/network failure -- it's a best-effort lookup", async () => {
    vi.spyOn(patientProfileApi, "getMyPatientProfile").mockRejectedValue(
      new ApiError(403, "forbidden"),
    );

    const { result } = renderHook(() => usePatientDisplayName("patient-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("formatPatientDisplayName", () => {
  it("formats 'Last, First' when both names are on file", () => {
    expect(formatPatientDisplayName("patient-1", PROFILE)).toBe(
      "Lovelace, Ada",
    );
  });

  it("falls back to the patient id with a visually clear unavailable marker when there's no data yet", () => {
    expect(formatPatientDisplayName("patient-1", undefined)).toBe(
      "patient-1 (name unavailable)",
    );
  });

  it("falls back the same way when demographics are present but both names are null", () => {
    const noName: PatientProfileResponse = {
      ...PROFILE,
      demographics: { firstName: null, lastName: null, dateOfBirth: null },
    };
    expect(formatPatientDisplayName("patient-1", noName)).toBe(
      "patient-1 (name unavailable)",
    );
  });
});
