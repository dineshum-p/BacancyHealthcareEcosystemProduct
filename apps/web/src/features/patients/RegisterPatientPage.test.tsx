import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useRegisterPatientModule from "./hooks/useRegisterPatient";
import { RegisterPatientPage } from "./RegisterPatientPage";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RegisterPatientPage />
    </QueryClientProvider>,
  );
}

function mockUseRegisterPatient(
  overrides: Partial<
    ReturnType<typeof useRegisterPatientModule.useRegisterPatient>
  >,
) {
  const mutate = vi.fn();
  vi.spyOn(useRegisterPatientModule, "useRegisterPatient").mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useRegisterPatientModule.useRegisterPatient>);
  return mutate;
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

describe("RegisterPatientPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides the registration form from a caller without write_patient (AC4)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );
    mockUseRegisterPatient({});

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  });

  describe("as a provider (has write_patient)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
      );
    });

    it("submits the form values to the registration mutation (AC1)", async () => {
      const user = userEvent.setup();
      const mutate = mockUseRegisterPatient({});

      renderPage();
      await user.type(screen.getByLabelText(/first name/i), "Jane");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
      await user.click(
        screen.getByRole("button", { name: /register patient/i }),
      );

      expect(mutate).toHaveBeenCalledWith({
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "1990-05-12",
      });
    });

    it("shows the assigned MRN once registration succeeds (AC1)", () => {
      mockUseRegisterPatient({ isSuccess: true, data: PATIENT });

      renderPage();

      expect(screen.getByText(/MRN-0001/)).toBeInTheDocument();
    });

    it("shows a validation error inline while keeping the form visible (AC3)", () => {
      mockUseRegisterPatient({
        isError: true,
        error: new Error("firstName should not be empty"),
      });

      renderPage();

      expect(
        screen.getByText("firstName should not be empty"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });
  });
});
