import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OnboardTenantResponse } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useOnboardTenantModule from "./hooks/useOnboardTenant";
import { OnboardTenantPage } from "./OnboardTenantPage";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/tenants/onboard",
}));

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

// The onboarding form's live pricing panel uses TanStack Query, so the page
// must render under a QueryClientProvider; a fresh client per render avoids
// cross-test cache bleed.
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OnboardTenantPage />
    </QueryClientProvider>,
  );
}

function mockUseOnboardTenant(
  overrides: Partial<ReturnType<typeof useOnboardTenantModule.useOnboardTenant>>,
) {
  const mutate = vi.fn();
  vi.spyOn(useOnboardTenantModule, "useOnboardTenant").mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useOnboardTenantModule.useOnboardTenant>);
  return mutate;
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/clinic name/i), "Acme Clinic");
  await user.type(screen.getByLabelText(/slug/i), "acme-clinic");
  // At least one module is required; plan defaults to "starter".
  await user.click(screen.getByRole("checkbox", { name: /clinic/i }));
  await user.type(
    screen.getByLabelText(/admin email/i),
    "admin@acme.example.com",
  );
  await user.click(screen.getByRole("button", { name: /onboard tenant/i }));
}

describe("OnboardTenantPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies a non-super_admin caller (AC4)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );
    mockUseOnboardTenant({});

    renderPage();

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/clinic name/i)).not.toBeInTheDocument();
  });

  describe("as a super_admin", () => {
    beforeEach(() => {
      setStoredAccessToken(
        fakeJwt({ userId: "u1", tenantId: "t1", role: "super_admin" }),
      );
    });

    it("submits the form values to the onboarding mutation (AC1)", async () => {
      const user = userEvent.setup();
      const mutate = mockUseOnboardTenant({});

      renderPage();
      await fillAndSubmit(user);

      expect(mutate).toHaveBeenCalledWith({
        name: "Acme Clinic",
        slug: "acme-clinic",
        plan: "starter",
        modules: ["clinic"],
        adminEmail: "admin@acme.example.com",
      });
    });

    it("redirects to the tenants list once the tenant is created (AC1/AC2)", () => {
      const response: OnboardTenantResponse = {
        tenant: {
          id: "t1",
          slug: "acme",
          name: "Acme Clinic",
          plan: "starter",
          status: "active",
          schemaName: "tenant_acme",
          adminSeedStatus: "succeeded",
          inviteStatus: "succeeded",
          modules: [],
        },
        adminSeed: { status: "succeeded" },
        invite: { status: "succeeded" },
      };
      mockUseOnboardTenant({ isSuccess: true, data: response });

      renderPage();

      expect(push).toHaveBeenCalledWith("/admin/tenants");
    });

    it("shows an error message when the submission itself fails", () => {
      mockUseOnboardTenant({
        isError: true,
        error: new Error("slug already taken"),
      });

      renderPage();

      expect(screen.getByText("slug already taken")).toBeInTheDocument();
    });
  });
});
