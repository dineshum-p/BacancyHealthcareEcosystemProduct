import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  PatientProfileResponse,
  VisitIntakeSummary,
} from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useVisitIntakesModule from "./hooks/useVisitIntakes";
import * as useLinkVisitIntakeModule from "./hooks/useLinkVisitIntake";
import * as usePatientDisplayNameModule from "./hooks/usePatientDisplayName";
import { VisitIntakeQueuePage } from "./VisitIntakeQueuePage";

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
      <VisitIntakeQueuePage />
    </QueryClientProvider>,
  );
}

function mockUseVisitIntakes(
  overrides: Partial<ReturnType<typeof useVisitIntakesModule.useVisitIntakes>>,
) {
  vi.spyOn(useVisitIntakesModule, "useVisitIntakes").mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useVisitIntakesModule.useVisitIntakes>);
}

function mockLink() {
  const mutate = vi.fn();
  vi.spyOn(useLinkVisitIntakeModule, "useLinkVisitIntake").mockReturnValue({
    mutate,
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useLinkVisitIntakeModule.useLinkVisitIntake>);
  return { mutate };
}

function mockDisplayNames() {
  vi.spyOn(usePatientDisplayNameModule, "usePatientDisplayName").mockReturnValue(
    { data: undefined, isLoading: false } as ReturnType<
      typeof usePatientDisplayNameModule.usePatientDisplayName
    >,
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

describe("VisitIntakeQueuePage (BAC-47, AC2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies a caller with no session at all", () => {
    mockUseVisitIntakes({ isLoading: true });
    mockLink();
    mockDisplayNames();

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  it("denies a provider -- no access to the tenant-wide triage queue (RBAC)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
    );
    mockUseVisitIntakes({ data: [] });
    mockLink();
    mockDisplayNames();

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  describe("as staff", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
      );
    });

    it("shows a loading state", () => {
      mockUseVisitIntakes({ isLoading: true });
      mockLink();
      mockDisplayNames();

      renderPage();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("shows an empty state when there are no pending intakes", () => {
      mockUseVisitIntakes({ data: [] });
      mockLink();
      mockDisplayNames();

      renderPage();

      expect(screen.getByText(/no pending/i)).toBeInTheDocument();
    });

    it("shows an error state", () => {
      mockUseVisitIntakes({ isError: true, error: new Error("boom") });
      mockLink();
      mockDisplayNames();

      renderPage();

      expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    });

    it("renders the queue and wires the link action to the link mutation", async () => {
      const user = userEvent.setup();
      mockUseVisitIntakes({ data: [INTAKE] });
      const { mutate } = mockLink();
      mockDisplayNames();

      renderPage();
      expect(screen.getByText("Persistent cough")).toBeInTheDocument();

      await user.type(screen.getByLabelText(/provider id/i), "provider-1");
      await user.type(screen.getByLabelText(/appointment id/i), "appt-1");
      await user.click(screen.getByRole("button", { name: /mark as booked/i }));

      expect(mutate).toHaveBeenCalledWith({
        id: "intake-1",
        input: { providerId: "provider-1", appointmentId: "appt-1" },
      });
    });
  });
});
