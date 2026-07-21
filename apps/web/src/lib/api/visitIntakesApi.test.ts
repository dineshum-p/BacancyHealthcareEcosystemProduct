import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  CreateVisitIntakeRequest,
  LinkVisitIntakeRequest,
  VisitIntakeSummary,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import { ApiError } from "./apiError";
import {
  createVisitIntake,
  getVisitIntake,
  linkVisitIntake,
  listVisitIntakes,
} from "./visitIntakesApi";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

const TOKEN = fakeJwt({
  userId: "patient-1",
  tenantId: "tenant-1",
  role: "patient",
});

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

describe("visitIntakesApi (BAC-47)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createVisitIntake", () => {
    it("rejects without a stored access token, without making a network call", async () => {
      const input: CreateVisitIntakeRequest = {
        reasonForVisit: "Persistent cough",
        symptoms: "Coughing for 3 days",
      };
      await expect(createVisitIntake(input)).rejects.toThrow(
        /not authenticated/i,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("POSTs /visit-intakes with auth headers (AC1)", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(INTAKE), { status: 201 }),
      );
      const input: CreateVisitIntakeRequest = {
        reasonForVisit: "Persistent cough",
        symptoms: "Coughing for 3 days, mild fever",
        whatsNewSinceLastVisit: "Started a new job",
      };

      const result = await createVisitIntake(input);

      expect(result).toEqual(INTAKE);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/visit-intakes$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });
  });

  describe("listVisitIntakes", () => {
    it("GETs /visit-intakes?status=pending (AC2)", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([INTAKE]), { status: 200 }),
      );

      const result = await listVisitIntakes("pending");

      expect(result).toEqual([INTAKE]);
      const [url] = vi.mocked(fetch).mock.calls[0];
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toBe("/visit-intakes");
      expect(requestUrl.searchParams.get("status")).toBe("pending");
    });

    it("omits ?status= when no status filter is given", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([INTAKE]), { status: 200 }),
      );

      await listVisitIntakes();

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(new URL(String(url)).searchParams.has("status")).toBe(false);
    });
  });

  describe("getVisitIntake", () => {
    it("GETs /visit-intakes/:id (AC3)", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(INTAKE), { status: 200 }),
      );

      const result = await getVisitIntake("intake-1");

      expect(result).toEqual(INTAKE);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/visit-intakes\/intake-1$/);
    });

    it("throws an ApiError carrying the 403 status on a forbidden read (AC3)", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Only the provider assigned to this visit intake may read it.",
          }),
          { status: 403 },
        ),
      );

      await expect(getVisitIntake("intake-1")).rejects.toMatchObject({
        status: 403,
      });
      await expect(getVisitIntake("intake-1")).rejects.toBeInstanceOf(
        ApiError,
      );
    });
  });

  describe("linkVisitIntake", () => {
    it("PATCHes /visit-intakes/:id/link with the provider + appointment ids", async () => {
      setStoredAccessToken(TOKEN);
      const linked = {
        ...INTAKE,
        status: "linked" as const,
        assignedProviderId: "provider-1",
        appointmentId: "appt-1",
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(linked), { status: 200 }),
      );
      const body: LinkVisitIntakeRequest = {
        providerId: "provider-1",
        appointmentId: "appt-1",
      };

      const result = await linkVisitIntake("intake-1", body);

      expect(result).toEqual(linked);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/visit-intakes\/intake-1\/link$/);
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(init?.body as string)).toEqual(body);
    });
  });
});
