import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientSelfRegistrationSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useSelfRegistrationsModule from "./hooks/useSelfRegistrations";
import * as useReviewModule from "./hooks/useReviewSelfRegistration";
import { PendingSelfRegistrationsPage } from "./PendingSelfRegistrationsPage";

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
      <PendingSelfRegistrationsPage />
    </QueryClientProvider>,
  );
}

function mockUseSelfRegistrations(
  overrides: Partial<
    ReturnType<typeof useSelfRegistrationsModule.useSelfRegistrations>
  >,
) {
  vi.spyOn(
    useSelfRegistrationsModule,
    "useSelfRegistrations",
  ).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useSelfRegistrationsModule.useSelfRegistrations>);
}

function mockMutations() {
  const approveMutate = vi.fn();
  const rejectMutate = vi.fn();
  const mergeMutate = vi.fn();
  vi.spyOn(useReviewModule, "useApproveSelfRegistration").mockReturnValue({
    mutate: approveMutate,
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useReviewModule.useApproveSelfRegistration>);
  vi.spyOn(useReviewModule, "useRejectSelfRegistration").mockReturnValue({
    mutate: rejectMutate,
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useReviewModule.useRejectSelfRegistration>);
  vi.spyOn(useReviewModule, "useMergeSelfRegistration").mockReturnValue({
    mutate: mergeMutate,
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useReviewModule.useMergeSelfRegistration>);
  return { approveMutate, rejectMutate, mergeMutate };
}

const REGISTRATION: PatientSelfRegistrationSummary = {
  id: "reg-1",
  tenantId: "tenant-1",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: null,
  phone: null,
  email: null,
  status: "pending",
  matchedPatientId: null,
  matchReason: null,
  resultingPatientId: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PendingSelfRegistrationsPage (BAC-37)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies a caller with no session at all", () => {
    mockUseSelfRegistrations({ isLoading: true });
    mockMutations();

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  it("denies a provider -- no access to the pending queue (RBAC)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
    );
    mockUseSelfRegistrations({ data: [] });
    mockMutations();

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  describe("as staff (has review_patient_self_registration but not write_patient)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
      );
    });

    it("shows a loading state", () => {
      mockUseSelfRegistrations({ isLoading: true });
      mockMutations();

      renderPage();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("shows an empty state when there are no pending registrations", () => {
      mockUseSelfRegistrations({ data: [] });
      mockMutations();

      renderPage();

      expect(screen.getByText(/no pending/i)).toBeInTheDocument();
    });

    it("shows an error state", () => {
      mockUseSelfRegistrations({ isError: true, error: new Error("boom") });
      mockMutations();

      renderPage();

      expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    });

    it("renders the queue and wires approve/reject to the review mutations", async () => {
      const user = userEvent.setup();
      mockUseSelfRegistrations({ data: [REGISTRATION] });
      const { approveMutate, rejectMutate } = mockMutations();

      renderPage();
      expect(screen.getByText("Doe, Jane")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /approve/i }));
      expect(approveMutate).toHaveBeenCalledWith("reg-1");

      await user.click(screen.getByRole("button", { name: /^reject$/i }));
      expect(rejectMutate).toHaveBeenCalledWith({
        id: "reg-1",
        reason: undefined,
      });
    });
  });

  describe("as clinic_admin (has review_patient_self_registration)", () => {
    it("shows the queue", () => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "clinic_admin" }),
      );
      mockUseSelfRegistrations({ data: [REGISTRATION] });
      mockMutations();

      renderPage();

      expect(screen.getByText("Doe, Jane")).toBeInTheDocument();
    });
  });
});
