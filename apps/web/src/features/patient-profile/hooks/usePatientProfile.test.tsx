import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientProfileResponse } from "@hep/shared-types";
import * as patientProfileApi from "@/src/lib/api/patientProfileApi";
import { ApiError } from "@/src/lib/api/apiError";
import { usePatientProfile } from "./usePatientProfile";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe({ patientId }: { patientId: string }) {
  const { data, isLoading, isError, error } = usePatientProfile(patientId);
  if (isLoading) return <div>loading profile</div>;
  if (isError)
    return (
      <div>
        error loading profile
        {error instanceof ApiError && `:${error.status}`}
      </div>
    );
  return <div>hasProfile:{String(data?.hasProfile)}</div>;
}

const EMPTY_PROFILE: PatientProfileResponse = {
  id: null,
  patientId: "patient-1",
  tenantId: "tenant-1",
  hasProfile: false,
  demographics: { firstName: null, lastName: null, dateOfBirth: null },
  allergies: [],
  chronicConditions: [],
  medications: [],
  createdAt: null,
  updatedAt: null,
};

describe("usePatientProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state", () => {
    vi.spyOn(patientProfileApi, "getMyPatientProfile").mockReturnValue(
      new Promise(() => {}),
    );
    renderWithClient(<Probe patientId="patient-1" />);
    expect(screen.getByText("loading profile")).toBeInTheDocument();
  });

  it("resolves with the caller's own profile (AC1)", async () => {
    vi.spyOn(patientProfileApi, "getMyPatientProfile").mockResolvedValue(
      EMPTY_PROFILE,
    );

    renderWithClient(<Probe patientId="patient-1" />);

    expect(await screen.findByText("hasProfile:false")).toBeInTheDocument();
    expect(patientProfileApi.getMyPatientProfile).toHaveBeenCalledWith(
      "patient-1",
    );
  });

  it("surfaces a 403 as an ApiError (AC3)", async () => {
    vi.spyOn(patientProfileApi, "getMyPatientProfile").mockRejectedValue(
      new ApiError(403, "Patients may only access their own records."),
    );

    renderWithClient(<Probe patientId="patient-1" />);

    expect(
      await screen.findByText("error loading profile:403"),
    ).toBeInTheDocument();
  });
});
