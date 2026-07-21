import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientProfileResponse } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import { ApiError } from "@/src/lib/api/apiError";
import * as usePatientProfileModule from "./hooks/usePatientProfile";
import * as useUpdatePatientProfileModule from "./hooks/useUpdatePatientProfile";
import { PatientProfilePage } from "./PatientProfilePage";

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
      <PatientProfilePage />
    </QueryClientProvider>,
  );
}

function mockProfile(
  overrides: Partial<
    ReturnType<typeof usePatientProfileModule.usePatientProfile>
  >,
) {
  return vi
    .spyOn(usePatientProfileModule, "usePatientProfile")
    .mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      ...overrides,
    } as ReturnType<typeof usePatientProfileModule.usePatientProfile>);
}

function mockUpdate(
  overrides: Partial<
    ReturnType<typeof useUpdatePatientProfileModule.useUpdatePatientProfile>
  >,
) {
  const mutate = vi.fn();
  vi.spyOn(
    useUpdatePatientProfileModule,
    "useUpdatePatientProfile",
  ).mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<
    typeof useUpdatePatientProfileModule.useUpdatePatientProfile
  >);
  return { mutate };
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

const FILLED_PROFILE: PatientProfileResponse = {
  ...EMPTY_PROFILE,
  id: "profile-1",
  hasProfile: true,
  demographics: {
    firstName: "Ada",
    lastName: "Lovelace",
    dateOfBirth: "1990-01-01",
  },
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PatientProfilePage (BAC-46)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("as a logged-in patient", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "patient-1", tenantId: "tenant-1", role: "patient" }),
      );
    });

    it("fetches the CALLER'S OWN patientId (from the session), not an arbitrary id", () => {
      const spy = mockProfile({ data: EMPTY_PROFILE });
      mockUpdate({});

      renderPage();

      expect(spy).toHaveBeenCalledWith("patient-1");
    });

    it("shows a loading state", () => {
      mockProfile({ isLoading: true });
      mockUpdate({});

      renderPage();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("shows a friendly empty state on first login (AC1)", () => {
      mockProfile({ data: EMPTY_PROFILE });
      mockUpdate({});

      renderPage();

      expect(
        screen.getByText(/haven.t added .*health profile/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/no allergies added yet/i),
      ).toBeInTheDocument();
    });

    it("renders the patient's allergies, chronic conditions, medications, and demographics (AC1)", () => {
      mockProfile({ data: FILLED_PROFILE });
      mockUpdate({});

      renderPage();

      expect(screen.getByText("Ada")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Penicillin")).toBeInTheDocument();
    });

    it("submits an edited field to the update mutation (AC2)", async () => {
      const user = userEvent.setup();
      mockProfile({ data: EMPTY_PROFILE });
      const { mutate } = mockUpdate({});

      renderPage();
      await user.click(screen.getByRole("button", { name: /add allergy/i }));
      await user.type(screen.getByLabelText(/substance/i), "Latex");
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(mutate).toHaveBeenCalledWith({
        allergies: [{ substance: "Latex" }],
        chronicConditions: [],
        medications: [],
      });
    });

    it("shows a saving state while the mutation is in flight (AC2)", () => {
      mockProfile({ data: EMPTY_PROFILE });
      mockUpdate({ isPending: true });

      renderPage();

      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    });

    it("confirms success after a save (AC2)", () => {
      mockProfile({ data: FILLED_PROFILE });
      mockUpdate({ isSuccess: true, data: FILLED_PROFILE });

      renderPage();

      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });

    it("shows an access-denied state instead of a raw error on a 403 (AC3)", () => {
      mockProfile({
        isError: true,
        error: new ApiError(403, "Patients may only access their own records."),
      });
      mockUpdate({});

      renderPage();

      expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
      expect(screen.queryByText(/add allergy/i)).not.toBeInTheDocument();
    });

    it("shows a generic error state for a non-403 failure", () => {
      mockProfile({ isError: true, error: new Error("boom") });
      mockUpdate({});

      renderPage();

      expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    });
  });
});
