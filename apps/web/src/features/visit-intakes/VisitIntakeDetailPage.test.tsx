import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { VisitIntakeSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import { ApiError } from "@/src/lib/api/apiError";
import * as useVisitIntakeModule from "./hooks/useVisitIntake";
import { VisitIntakeDetailPage } from "./VisitIntakeDetailPage";

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
      <VisitIntakeDetailPage id="intake-1" />
    </QueryClientProvider>,
  );
}

function mockUseVisitIntake(
  overrides: Partial<ReturnType<typeof useVisitIntakeModule.useVisitIntake>>,
) {
  vi.spyOn(useVisitIntakeModule, "useVisitIntake").mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useVisitIntakeModule.useVisitIntake>);
}

const INTAKE: VisitIntakeSummary = {
  id: "intake-1",
  tenantId: "tenant-1",
  patientId: "patient-1",
  reasonForVisit: "Persistent cough",
  symptoms: "Coughing for 3 days, mild fever",
  whatsNewSinceLastVisit: "Started a new job",
  status: "pending",
  assignedProviderId: null,
  appointmentId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("VisitIntakeDetailPage (BAC-47, AC3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setStoredAccessToken(
      fakeJwt({ userId: "provider-1", tenantId: "tenant-1", role: "provider" }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state", () => {
    mockUseVisitIntake({ isLoading: true });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders the intake's full details", () => {
    mockUseVisitIntake({ data: INTAKE });
    renderPage();

    expect(screen.getByText("Persistent cough")).toBeInTheDocument();
    expect(screen.getByText("Coughing for 3 days, mild fever")).toBeInTheDocument();
    expect(screen.getByText("Started a new job")).toBeInTheDocument();
  });

  it("renders ForbiddenView (not raw intake content or a generic error) on a 403 -- a provider NOT assigned to this intake (AC3)", () => {
    mockUseVisitIntake({
      isError: true,
      error: new ApiError(
        403,
        "Only the provider assigned to this visit intake may read it.",
      ),
    });

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByText("Persistent cough")).not.toBeInTheDocument();
  });

  it("shows a generic error state for a non-403 failure", () => {
    mockUseVisitIntake({ isError: true, error: new Error("boom") });
    renderPage();

    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
  });
});
