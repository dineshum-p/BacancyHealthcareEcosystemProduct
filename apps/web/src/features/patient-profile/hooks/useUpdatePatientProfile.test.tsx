import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  PatientProfileResponse,
  UpsertPatientProfileRequest,
} from "@hep/shared-types";
import * as patientProfileApi from "@/src/lib/api/patientProfileApi";
import { useUpdatePatientProfile } from "./useUpdatePatientProfile";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidateSpy };
}

const SAVED_PROFILE: PatientProfileResponse = {
  id: "profile-1",
  patientId: "patient-1",
  tenantId: "tenant-1",
  hasProfile: true,
  demographics: {
    firstName: "Ada",
    lastName: "Lovelace",
    dateOfBirth: "1990-01-01",
  },
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  chronicConditions: [],
  medications: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const INPUT: UpsertPatientProfileRequest = {
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  chronicConditions: [],
  medications: [],
};

function Probe({ patientId }: { patientId: string }) {
  const mutation = useUpdatePatientProfile(patientId);
  return (
    <div>
      <button onClick={() => mutation.mutate(INPUT)}>save</button>
      {mutation.isPending && <div>saving</div>}
      {mutation.isSuccess && (
        <div>saved:{String(mutation.data.hasProfile)}</div>
      )}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useUpdatePatientProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls upsertMyPatientProfile with the patientId and input, and exposes the saved profile (AC2)", async () => {
    vi.spyOn(patientProfileApi, "upsertMyPatientProfile").mockResolvedValue(
      SAVED_PROFILE,
    );

    const { invalidateSpy } = renderWithClient(<Probe patientId="patient-1" />);
    fireEvent.click(screen.getByText("save"));

    expect(await screen.findByText("saved:true")).toBeInTheDocument();
    expect(patientProfileApi.upsertMyPatientProfile).toHaveBeenCalledWith(
      "patient-1",
      INPUT,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["patient-profile", "patient-1"],
    });
  });

  it("surfaces a submission failure without losing entered data (AC2)", async () => {
    vi.spyOn(patientProfileApi, "upsertMyPatientProfile").mockRejectedValue(
      new Error("Something went wrong"),
    );

    renderWithClient(<Probe patientId="patient-1" />);
    fireEvent.click(screen.getByText("save"));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
});
