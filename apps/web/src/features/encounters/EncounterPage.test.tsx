import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EncounterSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useEncounterHistoryModule from "./hooks/useEncounterHistory";
import * as useCreateEncounterModule from "./hooks/useCreateEncounter";
import { EncounterPage } from "./EncounterPage";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

function renderPage(patientId = "p1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EncounterPage patientId={patientId} />
    </QueryClientProvider>,
  );
}

function mockHistory(
  overrides: Partial<
    ReturnType<typeof useEncounterHistoryModule.useEncounterHistory>
  >,
) {
  vi.spyOn(
    useEncounterHistoryModule,
    "useEncounterHistory",
  ).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useEncounterHistoryModule.useEncounterHistory>);
}

function mockCreate(
  overrides: Partial<
    ReturnType<typeof useCreateEncounterModule.useCreateEncounter>
  >,
) {
  const mutate = vi.fn();
  const reset = vi.fn();
  vi.spyOn(useCreateEncounterModule, "useCreateEncounter").mockReturnValue({
    mutate,
    reset,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useCreateEncounterModule.useCreateEncounter>);
  return { mutate, reset };
}

const ENCOUNTER: EncounterSummary = {
  id: "e1",
  tenantId: "tenant-1",
  patientId: "p1",
  soapNote: {
    subjective: "Patient reports headache.",
    objective: "Alert and oriented.",
    assessment: "Tension headache.",
    plan: "OTC analgesic, follow up in a week.",
  },
  vitals: null,
  allergies: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("EncounterPage (BAC-20)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides the page entirely from staff -- no read_encounter at all (RBAC)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );
    mockHistory({});
    mockCreate({});

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/subjective/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/no encounter notes yet/i),
    ).not.toBeInTheDocument();
  });

  describe("as a provider (has write_encounter)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
      );
    });

    it("shows the SOAP note editor (AC1)", () => {
      mockHistory({ data: [] });
      mockCreate({});

      renderPage();

      expect(screen.getByLabelText(/subjective/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sign & save note/i }),
      ).toBeInTheDocument();
    });

    it("submits the form values to the create-encounter mutation (AC1)", async () => {
      const user = userEvent.setup();
      mockHistory({ data: [] });
      const { mutate } = mockCreate({});

      renderPage();
      await user.type(screen.getByLabelText(/subjective/i), "s");
      await user.type(screen.getByLabelText(/objective/i), "o");
      await user.type(screen.getByLabelText(/assessment/i), "a");
      await user.type(screen.getByLabelText(/^plan/i), "p");
      await user.click(
        screen.getByRole("button", { name: /sign & save note/i }),
      );

      expect(mutate).toHaveBeenCalledWith({
        soapNote: { subjective: "s", objective: "o", assessment: "a", plan: "p" },
      });
    });

    it("shows a signed confirmation instead of the form once the note is saved, and lets the provider write another (AC1)", async () => {
      const user = userEvent.setup();
      mockHistory({ data: [ENCOUNTER] });
      const { reset } = mockCreate({ isSuccess: true, data: ENCOUNTER });

      renderPage();

      expect(screen.queryByLabelText(/subjective/i)).not.toBeInTheDocument();
      expect(screen.getByText(/signed/i)).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: /write another note/i }),
      );
      expect(reset).toHaveBeenCalled();
    });
  });

  describe("as clinic_admin (read-only oversight, no write_encounter)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "clinic_admin" }),
      );
    });

    it("shows history but never the note editor (RBAC)", () => {
      mockHistory({ data: [ENCOUNTER] });
      mockCreate({});

      renderPage();

      expect(screen.queryByLabelText(/subjective/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sign & save note/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Patient reports headache.")).toBeInTheDocument();
    });
  });

  it("shows the history's loading state", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
    );
    mockHistory({ isLoading: true });
    mockCreate({});

    renderPage();

    expect(screen.getByText(/loading encounter history/i)).toBeInTheDocument();
  });

  it("shows the history's empty state", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
    );
    mockHistory({ data: [] });
    mockCreate({});

    renderPage();

    expect(screen.getByText(/no encounter notes yet/i)).toBeInTheDocument();
  });
});
