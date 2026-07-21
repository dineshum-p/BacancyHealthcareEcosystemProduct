import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { VisitIntakeSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useSubmitVisitIntakeModule from "./hooks/useSubmitVisitIntake";
import { RequestVisitPage } from "./RequestVisitPage";

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
      <RequestVisitPage />
    </QueryClientProvider>,
  );
}

function mockSubmit(
  overrides: Partial<
    ReturnType<typeof useSubmitVisitIntakeModule.useSubmitVisitIntake>
  >,
) {
  const mutate = vi.fn();
  vi.spyOn(
    useSubmitVisitIntakeModule,
    "useSubmitVisitIntake",
  ).mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useSubmitVisitIntakeModule.useSubmitVisitIntake>);
  return { mutate };
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

describe("RequestVisitPage (BAC-47, AC1)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies a caller with no session at all", () => {
    mockSubmit({});
    renderPage();
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  it("denies a staff caller -- only a patient may request their own visit", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );
    mockSubmit({});
    renderPage();
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  describe("as a logged-in patient", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "patient-1", tenantId: "tenant-1", role: "patient" }),
      );
    });

    it("submits the form to the mutation", async () => {
      const user = userEvent.setup();
      const { mutate } = mockSubmit({});

      renderPage();
      await user.type(
        screen.getByLabelText(/reason for visit/i),
        "Persistent cough",
      );
      await user.type(
        screen.getByLabelText(/^symptoms$/i),
        "Coughing for 3 days",
      );
      await user.click(screen.getByRole("button", { name: /submit/i }));

      expect(mutate).toHaveBeenCalledWith({
        reasonForVisit: "Persistent cough",
        symptoms: "Coughing for 3 days",
      });
    });

    it("shows a clear pending-review confirmation instead of a silent redirect (AC1)", () => {
      mockSubmit({ isSuccess: true, data: INTAKE });

      renderPage();

      expect(screen.getByText(/pending staff review/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /submit/i }),
      ).not.toBeInTheDocument();
    });

    it("shows an inline error on submission failure without discarding the form", () => {
      mockSubmit({
        isError: true,
        error: new Error("reasonForVisit should not be empty"),
      });

      renderPage();

      expect(
        screen.getByText(/reasonForVisit should not be empty/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /submit/i }),
      ).toBeInTheDocument();
    });
  });
});
