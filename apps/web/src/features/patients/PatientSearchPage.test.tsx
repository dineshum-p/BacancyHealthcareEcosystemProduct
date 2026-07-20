import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useSearchPatientsModule from "./hooks/useSearchPatients";
import { PatientSearchPage } from "./PatientSearchPage";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

function mockUseSearchPatients(
  overrides: Partial<ReturnType<typeof useSearchPatientsModule.useSearchPatients>>,
) {
  vi.spyOn(useSearchPatientsModule, "useSearchPatients").mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useSearchPatientsModule.useSearchPatients>);
}

describe("PatientSearchPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies a caller with no session at all (AC4)", () => {
    mockUseSearchPatients({ isLoading: true });

    render(<PatientSearchPage />);

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  describe("as staff (has read_patient)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
      );
    });

    it("hides the register-patient link for a role without write_patient (AC4)", () => {
      mockUseSearchPatients({ data: { items: [], page: 1, limit: 20, total: 0 } });

      render(<PatientSearchPage />);

      expect(
        screen.queryByRole("link", { name: /register patient/i }),
      ).not.toBeInTheDocument();
    });

    it("shows a loading state while searching (AC2)", () => {
      mockUseSearchPatients({ isLoading: true });

      render(<PatientSearchPage />);

      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it("shows an empty state when there are zero results (AC2)", () => {
      mockUseSearchPatients({
        data: { items: [], page: 1, limit: 20, total: 0 },
      });

      render(<PatientSearchPage />);

      expect(screen.getByText(/no patients found/i)).toBeInTheDocument();
    });

    it("shows an error state when the search fails", () => {
      mockUseSearchPatients({ isError: true, error: new Error("boom") });

      render(<PatientSearchPage />);

      expect(screen.getByText(/couldn.t search patients/i)).toBeInTheDocument();
    });

    it("renders paginated results (AC2)", () => {
      mockUseSearchPatients({
        data: {
          items: [
            {
              id: "p1",
              tenantId: "t1",
              mrn: "MRN-0001",
              firstName: "Jane",
              lastName: "Doe",
              dateOfBirth: "1990-05-12",
              gender: null,
              phone: null,
              email: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          page: 1,
          limit: 20,
          total: 25,
        },
      });

      render(<PatientSearchPage />);

      expect(screen.getByText("Doe, Jane")).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    });

    it("omits the chart link for a role without read_encounter (BAC-20, RBAC)", () => {
      mockUseSearchPatients({
        data: {
          items: [
            {
              id: "p1",
              tenantId: "t1",
              mrn: "MRN-0001",
              firstName: "Jane",
              lastName: "Doe",
              dateOfBirth: "1990-05-12",
              gender: null,
              phone: null,
              email: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        },
      });

      render(<PatientSearchPage />);

      expect(
        screen.queryByRole("link", { name: /view chart/i }),
      ).not.toBeInTheDocument();
    });

    it("passes submitted search filters through to the query (AC2)", async () => {
      const user = userEvent.setup();
      mockUseSearchPatients({ data: { items: [], page: 1, limit: 20, total: 0 } });

      render(<PatientSearchPage />);
      await user.type(screen.getByLabelText(/^name/i), "Jane");
      await user.click(screen.getByRole("button", { name: /^search$/i }));

      const lastCall =
        vi.mocked(useSearchPatientsModule.useSearchPatients).mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual({ name: "Jane", page: 1 });
    });
  });

  describe("as a provider (has write_patient)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
      );
    });

    it("shows a link to the register-patient page (AC1/AC4)", () => {
      mockUseSearchPatients({ data: { items: [], page: 1, limit: 20, total: 0 } });

      render(<PatientSearchPage />);

      expect(
        screen.getByRole("link", { name: /register patient/i }),
      ).toHaveAttribute("href", "/patients/register");
    });

    it("shows a chart link to each patient's encounters page (BAC-20, AC1)", () => {
      mockUseSearchPatients({
        data: {
          items: [
            {
              id: "p1",
              tenantId: "t1",
              mrn: "MRN-0001",
              firstName: "Jane",
              lastName: "Doe",
              dateOfBirth: "1990-05-12",
              gender: null,
              phone: null,
              email: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        },
      });

      render(<PatientSearchPage />);

      expect(screen.getByRole("link", { name: /view chart/i })).toHaveAttribute(
        "href",
        "/patients/p1/encounters",
      );
    });
  });
});
