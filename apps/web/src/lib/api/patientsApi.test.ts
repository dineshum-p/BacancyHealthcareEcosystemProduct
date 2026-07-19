import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  PaginatedPatientsResponse,
  PatientSearchQuery,
  PatientSummary,
  RegisterPatientRequest,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import { registerPatient, searchPatients } from "./patientsApi";

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

const PATIENT: PatientSummary = {
  id: "p1",
  tenantId: "tenant-1",
  mrn: "MRN-0001",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: "female",
  phone: null,
  email: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("patientsApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("without a stored access token", () => {
    it("registerPatient rejects without making a network call", async () => {
      const input: RegisterPatientRequest = {
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "1990-05-12",
      };
      await expect(registerPatient(input)).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("searchPatients rejects without making a network call", async () => {
      await expect(searchPatients({})).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("registerPatient", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("POSTs /patients with the request body and auth headers (AC1)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(PATIENT), { status: 201 }),
      );

      const input: RegisterPatientRequest = {
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "1990-05-12",
      };
      const result = await registerPatient(input);

      expect(result).toEqual(PATIENT);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("throws a descriptive error using a single-string message body", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Duplicate patient" }), {
          status: 409,
        }),
      );

      await expect(
        registerPatient({
          firstName: "Jane",
          lastName: "Doe",
          dateOfBirth: "1990-05-12",
        }),
      ).rejects.toThrow("Duplicate patient");
    });

    it("joins a Nest-style array validation message into one error (AC3)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 400,
            message: [
              "firstName should not be empty",
              "dateOfBirth must be a valid ISO 8601 date string",
            ],
            error: "Bad Request",
          }),
          { status: 400 },
        ),
      );

      await expect(
        registerPatient({
          firstName: "",
          lastName: "Doe",
          dateOfBirth: "not-a-date",
        }),
      ).rejects.toThrow(
        "firstName should not be empty; dateOfBirth must be a valid ISO 8601 date string",
      );
    });
  });

  describe("searchPatients", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("GETs /patients with only the provided query params and auth headers (AC2)", async () => {
      const response: PaginatedPatientsResponse = {
        items: [PATIENT],
        page: 1,
        limit: 20,
        total: 1,
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );

      const query: PatientSearchQuery = { name: "Jane", page: 2 };
      const result = await searchPatients(query);

      expect(result).toEqual(response);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toBe("/patients");
      expect(requestUrl.searchParams.get("name")).toBe("Jane");
      expect(requestUrl.searchParams.get("page")).toBe("2");
      expect(requestUrl.searchParams.has("mrn")).toBe(false);
      expect(requestUrl.searchParams.has("dateOfBirth")).toBe(false);
      expect(requestUrl.searchParams.has("limit")).toBe(false);
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

      await expect(searchPatients({})).rejects.toThrow("Forbidden");
    });
  });
});
