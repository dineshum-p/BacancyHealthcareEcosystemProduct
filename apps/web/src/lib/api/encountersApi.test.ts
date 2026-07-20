import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  CreateEncounterRequest,
  EncounterSummary,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import { createEncounter, listEncounters } from "./encountersApi";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

const TOKEN = fakeJwt({
  userId: "user-1",
  tenantId: "tenant-1",
  role: "provider",
});

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
  vitals: { heartRate: 72 },
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("encountersApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("without a stored access token", () => {
    it("createEncounter rejects without making a network call", async () => {
      const input: CreateEncounterRequest = {
        soapNote: {
          subjective: "s",
          objective: "o",
          assessment: "a",
          plan: "p",
        },
      };
      await expect(createEncounter("p1", input)).rejects.toThrow(
        /not authenticated/i,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("listEncounters rejects without making a network call", async () => {
      await expect(listEncounters("p1")).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("createEncounter", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("POSTs /patients/:patientId/encounters with the request body and auth headers (AC1)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(ENCOUNTER), { status: 201 }),
      );

      const input: CreateEncounterRequest = {
        soapNote: ENCOUNTER.soapNote,
        vitals: { heartRate: 72 },
        allergies: [{ substance: "Penicillin", severity: "severe" }],
      };
      const result = await createEncounter("p1", input);

      expect(result).toEqual(ENCOUNTER);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/p1\/encounters$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("throws a descriptive error using a Nest-style array validation message (AC3)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 400,
            message: ["vitals.heartRate must not be greater than 250"],
            error: "Bad Request",
          }),
          { status: 400 },
        ),
      );

      await expect(
        createEncounter("p1", {
          soapNote: ENCOUNTER.soapNote,
          vitals: { heartRate: 900 },
        }),
      ).rejects.toThrow("vitals.heartRate must not be greater than 250");
    });
  });

  describe("listEncounters", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("GETs /patients/:patientId/encounters with auth headers (AC2)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([ENCOUNTER]), { status: 200 }),
      );

      const result = await listEncounters("p1");

      expect(result).toEqual([ENCOUNTER]);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/p1\/encounters$/);
      expect(init?.method ?? "GET").toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("throws a descriptive error when the response isn't ok", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
        }),
      );

      await expect(listEncounters("p1")).rejects.toThrow("Forbidden");
    });
  });
});
