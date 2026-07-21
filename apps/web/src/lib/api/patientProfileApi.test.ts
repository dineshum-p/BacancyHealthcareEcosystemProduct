import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  PatientProfileResponse,
  UpsertPatientProfileRequest,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import { ApiError } from "./apiError";
import { getMyPatientProfile, upsertMyPatientProfile } from "./patientProfileApi";

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
  chronicConditions: [{ name: "Asthma" }],
  medications: [{ name: "Albuterol", dosage: "90mcg" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("patientProfileApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("without a stored access token", () => {
    it("getMyPatientProfile rejects without making a network call", async () => {
      await expect(getMyPatientProfile("patient-1")).rejects.toThrow(
        /not authenticated/i,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("upsertMyPatientProfile rejects without making a network call", async () => {
      const input: UpsertPatientProfileRequest = {
        allergies: [],
        chronicConditions: [],
        medications: [],
      };
      await expect(
        upsertMyPatientProfile("patient-1", input),
      ).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("getMyPatientProfile", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("GETs /patients/:patientId/profile with auth headers (AC1)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(EMPTY_PROFILE), { status: 200 }),
      );

      const result = await getMyPatientProfile("patient-1");

      expect(result).toEqual(EMPTY_PROFILE);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/patient-1\/profile$/);
      expect(init?.method ?? "GET").toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("resolves the hasProfile:false empty shape on first login (AC1)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(EMPTY_PROFILE), { status: 200 }),
      );

      const result = await getMyPatientProfile("patient-1");
      expect(result.hasProfile).toBe(false);
    });

    it("throws an ApiError carrying status 403 when the API denies access (AC3)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Patients may only access their own records." }),
          { status: 403 },
        ),
      );

      const rejection = getMyPatientProfile("someone-elses-id");
      await expect(rejection).rejects.toBeInstanceOf(ApiError);
      await expect(rejection).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("upsertMyPatientProfile", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("PUTs /patients/:patientId/profile with the request body and auth headers (AC2)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(FILLED_PROFILE), { status: 200 }),
      );

      const input: UpsertPatientProfileRequest = {
        allergies: FILLED_PROFILE.allergies,
        chronicConditions: FILLED_PROFILE.chronicConditions,
        medications: FILLED_PROFILE.medications,
      };
      const result = await upsertMyPatientProfile("patient-1", input);

      expect(result).toEqual(FILLED_PROFILE);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/patient-1\/profile$/);
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("throws an ApiError carrying status 403 when the API denies access (AC3)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
        }),
      );

      const rejection = upsertMyPatientProfile("someone-elses-id", {
        allergies: [],
        chronicConditions: [],
        medications: [],
      });
      await expect(rejection).rejects.toBeInstanceOf(ApiError);
      await expect(rejection).rejects.toMatchObject({ status: 403 });
    });
  });
});
