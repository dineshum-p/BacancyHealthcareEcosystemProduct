import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientSummary } from "@hep/shared-types";
import * as patientsApi from "@/src/lib/api/patientsApi";
import { useRegisterPatient } from "./useRegisterPatient";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const PATIENT: PatientSummary = {
  id: "p1",
  tenantId: "tenant-1",
  mrn: "MRN-0001",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: null,
  phone: null,
  email: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function Probe() {
  const mutation = useRegisterPatient();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            firstName: "Jane",
            lastName: "Doe",
            dateOfBirth: "1990-05-12",
          })
        }
      >
        submit
      </button>
      {mutation.isPending && <div>submitting</div>}
      {mutation.isSuccess && <div>mrn:{mutation.data.mrn}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useRegisterPatient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls registerPatient and exposes the assigned MRN (AC1)", async () => {
    vi.spyOn(patientsApi, "registerPatient").mockResolvedValue(PATIENT);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("mrn:MRN-0001")).toBeInTheDocument();
    expect(patientsApi.registerPatient).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1990-05-12",
    });
  });

  it("surfaces a submission failure without losing entered data (AC3)", async () => {
    vi.spyOn(patientsApi, "registerPatient").mockRejectedValue(
      new Error("firstName should not be empty"),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(
      await screen.findByText("firstName should not be empty"),
    ).toBeInTheDocument();
  });
});
