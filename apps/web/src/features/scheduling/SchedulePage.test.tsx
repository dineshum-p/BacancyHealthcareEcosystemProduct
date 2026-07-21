import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppointmentSummary, PatientSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as patientsApi from "@/src/lib/api/patientsApi";
import * as useDayScheduleModule from "./hooks/useDaySchedule";
import * as useBookAppointmentModule from "./hooks/useBookAppointment";
import * as useUpdateAppointmentModule from "./hooks/useUpdateAppointment";
import { SchedulePage } from "./SchedulePage";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

function renderPage(
  props: {
    preselectedPatientId?: string;
    preselectedPatientName?: string;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SchedulePage {...props} />
    </QueryClientProvider>,
  );
}

function mockUseDaySchedule(
  overrides: Partial<ReturnType<typeof useDayScheduleModule.useDaySchedule>>,
) {
  vi.spyOn(useDayScheduleModule, "useDaySchedule").mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useDayScheduleModule.useDaySchedule>);
}

function mockUseBookAppointment(
  overrides: Partial<ReturnType<typeof useBookAppointmentModule.useBookAppointment>>,
) {
  const mutate = vi.fn();
  vi.spyOn(useBookAppointmentModule, "useBookAppointment").mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useBookAppointmentModule.useBookAppointment>);
  return mutate;
}

function mockUseUpdateAppointment(
  overrides: Partial<
    ReturnType<typeof useUpdateAppointmentModule.useUpdateAppointment>
  > = {},
) {
  const mutate = vi.fn();
  vi.spyOn(useUpdateAppointmentModule, "useUpdateAppointment").mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useUpdateAppointmentModule.useUpdateAppointment>);
  return mutate;
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

const APPOINTMENT: AppointmentSummary = {
  id: "appt-1",
  tenantId: "tenant-1",
  providerId: "provider-1",
  patientId: "patient-1",
  startTime: "2026-07-20T14:00:00.000Z",
  endTime: "2026-07-20T14:30:00.000Z",
  status: "booked",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

describe("SchedulePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("RBAC: provider role", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "provider-1", tenantId: "t1", role: "provider" }),
      );
    });

    it("does not show a provider picker and loads the caller's own schedule", () => {
      mockUseDaySchedule({ data: [] });
      mockUseBookAppointment({});
      mockUseUpdateAppointment();

      renderPage();

      expect(screen.queryByLabelText(/provider id/i)).not.toBeInTheDocument();
      expect(useDayScheduleModule.useDaySchedule).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: "provider-1" }),
        true,
      );
    });
  });

  describe("RBAC: clinic_admin / staff", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "staff-1", tenantId: "t1", role: "staff" }),
      );
    });

    it("shows a provider picker and does not load a schedule until one is entered", () => {
      mockUseDaySchedule({ data: undefined });
      mockUseBookAppointment({});
      mockUseUpdateAppointment();

      renderPage();

      expect(screen.getByLabelText(/provider id/i)).toBeInTheDocument();
      expect(useDayScheduleModule.useDaySchedule).toHaveBeenCalledWith(
        expect.anything(),
        false,
      );
      expect(
        screen.getByText(/enter a provider id/i),
      ).toBeInTheDocument();
    });

    it("loads the entered provider's schedule", async () => {
      const user = userEvent.setup();
      mockUseDaySchedule({ data: [] });
      mockUseBookAppointment({});
      mockUseUpdateAppointment();

      renderPage();
      await user.type(screen.getByLabelText(/^provider id$/i), "provider-9");

      expect(useDayScheduleModule.useDaySchedule).toHaveBeenLastCalledWith(
        expect.objectContaining({ providerId: "provider-9" }),
        true,
      );
    });
  });

  describe("day schedule states (AC4)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "provider-1", tenantId: "t1", role: "provider" }),
      );
      mockUseBookAppointment({});
      mockUseUpdateAppointment();
    });

    it("shows a loading state", () => {
      mockUseDaySchedule({ isLoading: true });
      renderPage();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("shows an error state", () => {
      mockUseDaySchedule({ isError: true });
      renderPage();
      expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    });

    it("shows an empty state when no appointments are booked that day", () => {
      mockUseDaySchedule({ data: [] });
      renderPage();
      expect(screen.getByText(/no appointments/i)).toBeInTheDocument();
    });

    it("renders the day's appointments", () => {
      mockUseDaySchedule({ data: [APPOINTMENT] });
      renderPage();
      expect(screen.getByText(/booked/i)).toBeInTheDocument();
    });
  });

  describe("booking a conflict (AC2)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "provider-1", tenantId: "t1", role: "provider" }),
      );
      mockUseDaySchedule({ data: [] });
      mockUseUpdateAppointment();
    });

    it("submits a booking and surfaces a 409 conflict inline without losing entered data", async () => {
      const user = userEvent.setup();
      vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
        items: [PATIENT],
        page: 1,
        limit: 20,
        total: 1,
      });
      const mutate = mockUseBookAppointment({
        isError: true,
        error: new Error(
          "This provider already has a booked appointment overlapping the requested slot.",
        ),
      });

      renderPage();
      await user.type(screen.getByLabelText(/patient name/i), "Jane");
      await user.click(screen.getByRole("button", { name: /search/i }));
      await user.click(await screen.findByRole("button", { name: /select/i }));
      await user.type(
        screen.getByLabelText(/^date$/i, { selector: "#booking-date" }),
        "2026-07-20",
      );
      await user.type(screen.getByLabelText(/start time/i), "14:00");
      await user.type(screen.getByLabelText(/end time/i), "14:30");
      await user.click(
        screen.getByRole("button", { name: /book appointment/i }),
      );

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: "provider-1",
          patientId: "patient-1",
        }),
      );
      expect(
        screen.getByText(/already has a booked appointment/i),
      ).toBeInTheDocument();
      // The selected patient (entered data) is still visible, not reset.
      expect(screen.getByText(/Doe, Jane/)).toBeInTheDocument();
    });
  });

  describe("reschedule / cancel (AC3)", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "provider-1", tenantId: "t1", role: "provider" }),
      );
      mockUseDaySchedule({ data: [APPOINTMENT] });
      mockUseBookAppointment({});
    });

    it("cancels an appointment after confirming", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const mutate = mockUseUpdateAppointment();

      renderPage();
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mutate).toHaveBeenCalledWith({
        id: "appt-1",
        input: { action: "cancel" },
      });
    });

    it("reschedules an appointment to a new time range", async () => {
      const user = userEvent.setup();
      const mutate = mockUseUpdateAppointment();

      renderPage();
      await user.click(screen.getByRole("button", { name: /reschedule/i }));
      const startInput = screen.getByLabelText(/new start time/i);
      const endInput = screen.getByLabelText(/new end time/i);
      await user.clear(startInput);
      await user.type(startInput, "15:00");
      await user.clear(endInput);
      await user.type(endInput, "15:30");
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(mutate).toHaveBeenCalledWith({
        id: "appt-1",
        input: {
          action: "reschedule",
          startTime: "2026-07-20T15:00:00.000Z",
          endTime: "2026-07-20T15:30:00.000Z",
        },
      });
    });
  });

  describe("pre-filled from the visit-intake queue (BAC-47)", () => {
    it("forwards preselectedPatientId/preselectedPatientName into the booking form", async () => {
      setStoredAccessToken(
        fakeJwt({ userId: "provider-1", tenantId: "t1", role: "provider" }),
      );
      mockUseDaySchedule({ data: [] });
      mockUseBookAppointment({});
      mockUseUpdateAppointment();
      vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
        items: [PATIENT],
        page: 1,
        limit: 20,
        total: 1,
      });

      renderPage({
        preselectedPatientId: "patient-1",
        preselectedPatientName: "Jane Doe",
      });

      // Auto-SELECTED (not just listed as a search result): the booking
      // fields are already showing and there's a "Change patient" escape
      // hatch, exactly as if the caller had clicked "Select" themselves.
      expect(await screen.findByLabelText(/start time/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /change patient/i }),
      ).toBeInTheDocument();
      expect(patientsApi.searchPatients).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Jane Doe" }),
      );
    });
  });
});
