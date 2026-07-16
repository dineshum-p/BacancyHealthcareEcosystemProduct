import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TenantSummary } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useTenantsModule from "./hooks/useTenants";
import { TenantsListPage } from "./TenantsListPage";

// TenantsListPage renders inside ConsoleShell, which reads usePathname() and
// calls router.replace() on sign-out; stub next/navigation for jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/tenants",
}));

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

function mockUseTenants(
  overrides: Partial<ReturnType<typeof useTenantsModule.useTenants>>,
) {
  vi.spyOn(useTenantsModule, "useTenants").mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useTenantsModule.useTenants>);
}

describe("TenantsListPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies a non-super_admin caller (AC4)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );
    mockUseTenants({ isLoading: true });

    render(<TenantsListPage />);

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  describe("as a super_admin", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "super_admin" }),
      );
    });

    it("shows a loading state while fetching (AC3)", () => {
      mockUseTenants({ isLoading: true });

      render(<TenantsListPage />);

      expect(screen.getByText(/loading tenants/i)).toBeInTheDocument();
    });

    it("shows an empty state when there are zero tenants (AC3)", () => {
      mockUseTenants({ data: [] });

      render(<TenantsListPage />);

      expect(screen.getByText(/no tenants yet/i)).toBeInTheDocument();
    });

    it("shows an error state when the fetch fails", () => {
      mockUseTenants({ isError: true, error: new Error("boom") });

      render(<TenantsListPage />);

      expect(screen.getByText(/couldn.t load tenants/i)).toBeInTheDocument();
    });

    it("renders each tenant with status and provisioning result columns (AC3)", () => {
      const tenants: TenantSummary[] = [
        {
          id: "t1",
          slug: "acme",
          name: "Acme Inc",
          plan: "starter",
          status: "active",
          schemaName: "tenant_acme",
          adminSeedStatus: "succeeded",
          inviteStatus: "failed",
          modules: [],
        },
      ];
      mockUseTenants({ data: tenants });

      render(<TenantsListPage />);

      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
      expect(screen.getByText("acme")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
      expect(screen.getByText(/admin seed: succeeded/i)).toBeInTheDocument();
      expect(screen.getByText(/invite: failed/i)).toBeInTheDocument();
    });
  });
});
