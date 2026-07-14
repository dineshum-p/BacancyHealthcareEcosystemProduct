import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OnboardTenantResponse } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import * as useOnboardTenantModule from "./hooks/useOnboardTenant";
import { OnboardTenantPage } from "./OnboardTenantPage";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
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
  await user.type(screen.getByLabelText(/plan/i), "starter");
  await user.type(
    screen.getByLabelText(/admin email/i),
    "admin@acme.example.com",
  );
  await user.click(screen.getByRole("button", { name: /onboard tenant/i }));
}

describe("OnboardTenantPage", () => {
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
    mockUseOnboardTenant({});

    render(<OnboardTenantPage />);

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

      render(<OnboardTenantPage />);
      await fillAndSubmit(user);

      expect(mutate).toHaveBeenCalledWith({
        name: "Acme Clinic",
        slug: "acme-clinic",
        plan: "starter",
        adminEmail: "admin@acme.example.com",
      });
    });

    it("renders the tenant as active plus a partial-failure result (AC1/AC2)", () => {
      const response: OnboardTenantResponse = {
        tenant: {
          id: "t1",
          slug: "acme",
          name: "Acme Clinic",
          plan: "starter",
          status: "active",
          schemaName: "tenant_acme",
          adminSeedStatus: "failed",
          inviteStatus: "skipped",
        },
        adminSeed: { status: "failed", message: "email already registered" },
        invite: { status: "skipped" },
      };
      mockUseOnboardTenant({ isSuccess: true, data: response });

      render(<OnboardTenantPage />);

      expect(screen.getByText("Acme Clinic")).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/admin seed: failed/i)).toBeInTheDocument();
      expect(screen.getByText("email already registered")).toBeInTheDocument();
    });

    it("shows an error message when the submission itself fails", () => {
      mockUseOnboardTenant({
        isError: true,
        error: new Error("slug already taken"),
      });

      render(<OnboardTenantPage />);

      expect(screen.getByText("slug already taken")).toBeInTheDocument();
    });
  });
});
