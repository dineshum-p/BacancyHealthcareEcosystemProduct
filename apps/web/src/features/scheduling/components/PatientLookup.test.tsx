import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PaginatedPatientsResponse, PatientSummary } from "@hep/shared-types";
import * as patientsApi from "@/src/lib/api/patientsApi";
import { PatientLookup } from "./PatientLookup";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const PATIENT: PatientSummary = {
  id: "patient-1",
  tenantId: "tenant-1",
  mrn: "MRN-0001",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: "female",
  phone: "+15551234567",
  email: "jane@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PatientLookup (BAC-21, AC1 -- reuses BAC-17's patient search)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches by name and lists matching patients with their contact info", async () => {
    const user = userEvent.setup();
    const response: PaginatedPatientsResponse = {
      items: [PATIENT],
      page: 1,
      limit: 20,
      total: 1,
    };
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue(response);

    renderWithClient(<PatientLookup onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText(/patient name/i), "Jane");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(await screen.findByText(/Doe, Jane/)).toBeInTheDocument();
    expect(screen.getByText("MRN-0001")).toBeInTheDocument();
    expect(patientsApi.searchPatients).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane" }),
    );
  });

  it("calls onSelect with the chosen patient", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT],
      page: 1,
      limit: 20,
      total: 1,
    });
    const onSelect = vi.fn();

    renderWithClient(<PatientLookup onSelect={onSelect} />);
    await user.type(screen.getByLabelText(/patient name/i), "Jane");
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.click(await screen.findByRole("button", { name: /select/i }));

    expect(onSelect).toHaveBeenCalledWith(PATIENT);
  });

  it("shows an empty state when no patient matches", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    });

    renderWithClient(<PatientLookup onSelect={vi.fn()} />);
    await user.type(screen.getByLabelText(/patient name/i), "Nobody");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(await screen.findByText(/no patients found/i)).toBeInTheDocument();
  });

  describe("BAC-47: pre-filling from the visit-intake queue's 'Book appointment' link", () => {
    it("auto-searches on mount when given an initialName", async () => {
      vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
        items: [PATIENT],
        page: 1,
        limit: 20,
        total: 1,
      });

      renderWithClient(
        <PatientLookup onSelect={vi.fn()} initialName="Jane Doe" />,
      );

      await screen.findByText(/Doe, Jane/);
      expect(patientsApi.searchPatients).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Jane Doe" }),
      );
      expect(screen.getByLabelText(/patient name/i)).toHaveValue("Jane Doe");
    });

    it("auto-selects the patient matching initialPatientId once results load", async () => {
      vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
        items: [PATIENT],
        page: 1,
        limit: 20,
        total: 1,
      });
      const onSelect = vi.fn();

      renderWithClient(
        <PatientLookup
          onSelect={onSelect}
          initialName="Jane Doe"
          initialPatientId="patient-1"
        />,
      );

      await waitFor(() => expect(onSelect).toHaveBeenCalledWith(PATIENT));
    });

    it("does not auto-select when no result matches initialPatientId -- falls back to manual search", async () => {
      vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
        items: [PATIENT],
        page: 1,
        limit: 20,
        total: 1,
      });
      const onSelect = vi.fn();

      renderWithClient(
        <PatientLookup
          onSelect={onSelect}
          initialName="Jane Doe"
          initialPatientId="some-other-patient"
        />,
      );

      await screen.findByText(/Doe, Jane/);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
