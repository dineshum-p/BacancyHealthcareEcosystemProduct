import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  MergeSelfRegistrationRequest,
  PatientSelfRegistrationSummary,
  RejectSelfRegistrationRequest,
  SelfRegisterPatientRequest,
  SelfRegistrationReceipt,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import {
  approveSelfRegistration,
  listSelfRegistrations,
  mergeSelfRegistration,
  rejectSelfRegistration,
  submitSelfRegistration,
} from "./selfRegistrationsApi";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

const TOKEN = fakeJwt({
  userId: "user-1",
  tenantId: "tenant-1",
  role: "staff",
});

const RECEIPT: SelfRegistrationReceipt = {
  id: "reg-1",
  tenantId: "tenant-1",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SUMMARY: PatientSelfRegistrationSummary = {
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

describe("selfRegistrationsApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("submitSelfRegistration", () => {
    it("POSTs the public, tenant-scoped endpoint with NO auth headers (BAC-37, public AC)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(RECEIPT), { status: 201 }),
      );
      const input: SelfRegisterPatientRequest = {
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "1990-05-12",
      };

      const result = await submitSelfRegistration("acme", input);

      expect(result).toEqual(RECEIPT);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/public\/tenants\/acme\/patients$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBeNull();
    });

    it("succeeds with no stored access token at all -- genuinely unauthenticated", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(RECEIPT), { status: 201 }),
      );

      await expect(
        submitSelfRegistration("acme", {
          firstName: "Jane",
          lastName: "Doe",
          dateOfBirth: "1990-05-12",
        }),
      ).resolves.toEqual(RECEIPT);
    });

    it("throws a descriptive error when the request fails", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
        }),
      );

      await expect(
        submitSelfRegistration("acme", {
          firstName: "Jane",
          lastName: "Doe",
          dateOfBirth: "1990-05-12",
        }),
      ).rejects.toThrow("Too many requests");
    });
  });

  describe("listSelfRegistrations", () => {
    it("rejects without a stored access token, without making a network call", async () => {
      await expect(listSelfRegistrations("pending")).rejects.toThrow(
        /not authenticated/i,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("GETs the pending queue with auth headers and ?status= (BAC-37)", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([SUMMARY]), { status: 200 }),
      );

      const result = await listSelfRegistrations("pending");

      expect(result).toEqual([SUMMARY]);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toBe("/patients/self-registrations");
      expect(requestUrl.searchParams.get("status")).toBe("pending");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });
  });

  describe("approveSelfRegistration", () => {
    it("POSTs :id/approve with auth headers", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ...SUMMARY, status: "approved" }), {
          status: 200,
        }),
      );

      const result = await approveSelfRegistration("reg-1");

      expect(result.status).toBe("approved");
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/self-registrations\/reg-1\/approve$/);
      expect(init?.method).toBe("POST");
    });
  });

  describe("rejectSelfRegistration", () => {
    it("POSTs :id/reject with the reason body", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ...SUMMARY, status: "rejected" }), {
          status: 200,
        }),
      );
      const body: RejectSelfRegistrationRequest = { reason: "Not legitimate." };

      const result = await rejectSelfRegistration("reg-1", body.reason);

      expect(result.status).toBe("rejected");
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/self-registrations\/reg-1\/reject$/);
      expect(JSON.parse(init?.body as string)).toEqual(body);
    });
  });

  describe("mergeSelfRegistration", () => {
    it("POSTs :id/merge with the target patient id", async () => {
      setStoredAccessToken(TOKEN);
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ...SUMMARY, status: "merged" }), {
          status: 200,
        }),
      );
      const body: MergeSelfRegistrationRequest = {
        targetPatientId: "existing-patient-1",
      };

      const result = await mergeSelfRegistration(
        "reg-1",
        body.targetPatientId,
      );

      expect(result.status).toBe("merged");
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/patients\/self-registrations\/reg-1\/merge$/);
      expect(JSON.parse(init?.body as string)).toEqual(body);
    });
  });
});
