import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type {
  OnboardTenantRequest,
  OnboardTenantResponse,
  TenantSummary,
} from "@hep/shared-types";
import { setStoredAccessToken } from "../auth/session";
import { listTenants, onboardTenant } from "./tenantsApi";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

const TOKEN = fakeJwt({
  userId: "user-1",
  tenantId: "tenant-1",
  role: "super_admin",
});

describe("tenantsApi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("without a stored access token", () => {
    it("listTenants rejects without making a network call", async () => {
      await expect(listTenants()).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("onboardTenant rejects without making a network call", async () => {
      await expect(
        onboardTenant({
          name: "Acme",
          slug: "acme",
          plan: "starter",
          modules: ["clinic"],
          adminEmail: "admin@acme.example.com",
        }),
      ).rejects.toThrow(/not authenticated/i);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("listTenants", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("GETs /tenants with the bearer token and tenant header", async () => {
      const tenants: TenantSummary[] = [
        {
          id: "t1",
          slug: "acme",
          name: "Acme",
          plan: "starter",
          status: "active",
          schemaName: "tenant_acme",
          adminSeedStatus: "succeeded",
          inviteStatus: "succeeded",
          modules: [],
        },
      ];
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(tenants), { status: 200 }),
      );

      const result = await listTenants();

      expect(result).toEqual(tenants);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/tenants$/);
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

      await expect(listTenants()).rejects.toThrow("Forbidden");
    });
  });

  describe("onboardTenant", () => {
    beforeEach(() => {
      setStoredAccessToken(TOKEN);
    });

    it("POSTs /tenants/onboard with the request body and auth headers", async () => {
      const response: OnboardTenantResponse = {
        tenant: {
          id: "t1",
          slug: "acme",
          name: "Acme",
          plan: "starter",
          status: "active",
          schemaName: "tenant_acme",
          adminSeedStatus: "failed",
          inviteStatus: "skipped",
          modules: [],
        },
        adminSeed: { status: "failed", message: "email already registered" },
        invite: { status: "skipped" },
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(response), { status: 201 }),
      );

      const input: OnboardTenantRequest = {
        name: "Acme",
        slug: "acme",
        plan: "starter",
        modules: ["clinic"],
        adminEmail: "admin@acme.example.com",
      };
      const result = await onboardTenant(input);

      expect(result).toEqual(response);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/tenants\/onboard$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.get("X-Tenant-Id")).toBe("tenant-1");
    });

    it("throws a descriptive error when the response isn't ok", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "slug already taken" }), {
          status: 409,
        }),
      );

      await expect(
        onboardTenant({
          name: "Acme",
          slug: "acme",
          plan: "starter",
          modules: ["clinic"],
          adminEmail: "admin@acme.example.com",
        }),
      ).rejects.toThrow("slug already taken");
    });
  });
});
