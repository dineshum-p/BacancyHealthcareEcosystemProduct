import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  AppointmentQuery,
  AppointmentSummary,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import { bookAppointment, getDaySchedule, updateAppointment } from "./schedulingApi";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

const TOKEN = fakeJwt({
  userId: "provider-1",
  tenantId: "tenant-1",
  role: "clinic_admin",
});

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

describe("schedulingApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("without a stored access token", () => {
    it("bookAppointment rejects without making a network call", async () => {
      const input: CreateAppointmentRequest = {
        providerId: "provider-1",
        patientId: "patient-1",
        startTime: "2026-07-20T14:00:00.000Z",
        endTime: "2026-07-20T14:30:00.000Z",
        notifyChannel: "sms",
        notifyTo: "+15551234567",
      };
      await expect(bookAppointment(input)).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("getDaySchedule rejects without making a network call", async () => {
      await expect(
        getDaySchedule({ date: "2026-07-20" }),
      ).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("updateAppointment rejects without making a network call", async () => {
      await expect(
        updateAppointment("appt-1", { action: "cancel" }),
      ).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("bookAppointment (AC1)", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("POSTs /appointments with the request body and auth headers", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(APPOINTMENT), { status: 201 }),
      );

      const input: CreateAppointmentRequest = {
        providerId: "provider-1",
        patientId: "patient-1",
        startTime: "2026-07-20T14:00:00.000Z",
        endTime: "2026-07-20T14:30:00.000Z",
        notifyChannel: "sms",
        notifyTo: "+15551234567",
      };
      const result = await bookAppointment(input);

      expect(result).toEqual(APPOINTMENT);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/appointments$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("surfaces a 409 double-booking conflict with a clear inline message (AC2)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            message:
              "This provider already has a booked appointment overlapping the requested slot.",
          }),
          { status: 409 },
        ),
      );

      await expect(
        bookAppointment({
          providerId: "provider-1",
          patientId: "patient-1",
          startTime: "2026-07-20T14:00:00.000Z",
          endTime: "2026-07-20T14:30:00.000Z",
          notifyChannel: "sms",
          notifyTo: "+15551234567",
        }),
      ).rejects.toThrow(/already has a booked appointment/i);
    });

    it("joins a Nest-style array validation message into one error", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ message: ["providerId should not be empty"] }),
          { status: 400 },
        ),
      );

      await expect(
        bookAppointment({
          providerId: "",
          patientId: "patient-1",
          startTime: "2026-07-20T14:00:00.000Z",
          endTime: "2026-07-20T14:30:00.000Z",
          notifyChannel: "sms",
          notifyTo: "+15551234567",
        }),
      ).rejects.toThrow("providerId should not be empty");
    });
  });

  describe("getDaySchedule (AC4)", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("GETs /appointments with the date and providerId query params", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([APPOINTMENT]), { status: 200 }),
      );

      const query: AppointmentQuery = {
        date: "2026-07-20",
        providerId: "provider-1",
      };
      const result = await getDaySchedule(query);

      expect(result).toEqual([APPOINTMENT]);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toBe("/appointments");
      expect(requestUrl.searchParams.get("date")).toBe("2026-07-20");
      expect(requestUrl.searchParams.get("providerId")).toBe("provider-1");
      expect(init?.method ?? "GET").toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("omits providerId from the query string when not provided (provider role)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      await getDaySchedule({ date: "2026-07-20" });

      const [url] = vi.mocked(fetch).mock.calls[0];
      const requestUrl = new URL(String(url));
      expect(requestUrl.searchParams.has("providerId")).toBe(false);
    });

    it("throws a descriptive error when the response isn't ok", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
        }),
      );

      await expect(getDaySchedule({ date: "2026-07-20" })).rejects.toThrow(
        "Forbidden",
      );
    });
  });

  describe("updateAppointment (AC3)", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("PATCHes /appointments/:id with a reschedule action", async () => {
      const rescheduled: AppointmentSummary = {
        ...APPOINTMENT,
        startTime: "2026-07-20T15:00:00.000Z",
        endTime: "2026-07-20T15:30:00.000Z",
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(rescheduled), { status: 200 }),
      );

      const input: UpdateAppointmentRequest = {
        action: "reschedule",
        startTime: "2026-07-20T15:00:00.000Z",
        endTime: "2026-07-20T15:30:00.000Z",
      };
      const result = await updateAppointment("appt-1", input);

      expect(result).toEqual(rescheduled);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/appointments\/appt-1$/);
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("PATCHes /appointments/:id with a cancel action", async () => {
      const cancelled: AppointmentSummary = {
        ...APPOINTMENT,
        status: "cancelled",
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(cancelled), { status: 200 }),
      );

      const result = await updateAppointment("appt-1", { action: "cancel" });

      expect(result.status).toBe("cancelled");
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(init?.body as string)).toEqual({ action: "cancel" });
    });

    it("surfaces a 409 conflict (e.g. already cancelled, or a concurrent update)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ message: "This appointment has already been cancelled." }),
          { status: 409 },
        ),
      );

      await expect(
        updateAppointment("appt-1", { action: "cancel" }),
      ).rejects.toThrow(/already been cancelled/i);
    });
  });
});
