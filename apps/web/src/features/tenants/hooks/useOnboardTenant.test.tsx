import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OnboardTenantResponse } from "@hep/shared-types";
import * as tenantsApi from "@/src/lib/api/tenantsApi";
import { useOnboardTenant } from "./useOnboardTenant";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const RESPONSE: OnboardTenantResponse = {
  tenant: {
    id: "t1",
    slug: "acme",
    name: "Acme",
    plan: "starter",
    status: "active",
    schemaName: "tenant_acme",
    adminSeedStatus: "succeeded",
    inviteStatus: "succeeded",
  },
  adminSeed: { status: "succeeded" },
  invite: { status: "succeeded" },
};

function Probe() {
  const mutation = useOnboardTenant();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            name: "Acme",
            slug: "acme",
            plan: "starter",
            adminEmail: "admin@acme.example.com",
          })
        }
      >
        submit
      </button>
      {mutation.isPending && <div>submitting</div>}
      {mutation.isSuccess && <div>tenant:{mutation.data.tenant.slug}</div>}
      {mutation.isError && <div>failed</div>}
    </div>
  );
}

describe("useOnboardTenant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onboardTenant and exposes the result (AC1/AC2)", async () => {
    vi.spyOn(tenantsApi, "onboardTenant").mockResolvedValue(RESPONSE);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("tenant:acme")).toBeInTheDocument();
    expect(tenantsApi.onboardTenant).toHaveBeenCalledWith({
      name: "Acme",
      slug: "acme",
      plan: "starter",
      adminEmail: "admin@acme.example.com",
    });
  });

  it("surfaces a submission failure", async () => {
    vi.spyOn(tenantsApi, "onboardTenant").mockRejectedValue(
      new Error("slug already taken"),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("failed")).toBeInTheDocument();
  });
});
