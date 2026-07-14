import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TenantSummary } from "@hep/shared-types";
import * as tenantsApi from "@/src/lib/api/tenantsApi";
import { useTenants } from "./useTenants";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe() {
  const { data, isLoading, isError } = useTenants();
  if (isLoading) return <div>loading tenants</div>;
  if (isError) return <div>error loading tenants</div>;
  return <div>{data?.length ?? 0} tenants</div>;
}

describe("useTenants", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state", () => {
    vi.spyOn(tenantsApi, "listTenants").mockReturnValue(new Promise(() => {}));
    renderWithClient(<Probe />);
    expect(screen.getByText("loading tenants")).toBeInTheDocument();
  });

  it("resolves with the fetched tenants (AC3)", async () => {
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
      },
    ];
    vi.spyOn(tenantsApi, "listTenants").mockResolvedValue(tenants);

    renderWithClient(<Probe />);

    expect(await screen.findByText("1 tenants")).toBeInTheDocument();
  });

  it("surfaces a fetch failure", async () => {
    vi.spyOn(tenantsApi, "listTenants").mockRejectedValue(
      new Error("boom"),
    );

    renderWithClient(<Probe />);

    expect(await screen.findByText("error loading tenants")).toBeInTheDocument();
  });
});
