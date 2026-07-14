import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { OnboardTenantResponse } from "@hep/shared-types";
import { ProvisioningResultCard } from "./ProvisioningResultCard";

describe("ProvisioningResultCard", () => {
  it("shows the tenant as active and both steps succeeded (AC1/AC2)", () => {
    const response: OnboardTenantResponse = {
      tenant: {
        id: "t1",
        slug: "acme",
        name: "Acme Inc",
        plan: "starter",
        status: "active",
        schemaName: "tenant_acme",
        adminSeedStatus: "succeeded",
        inviteStatus: "succeeded",
      },
      adminSeed: { status: "succeeded" },
      invite: { status: "succeeded" },
    };

    render(<ProvisioningResultCard result={response} />);

    expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/admin seed: succeeded/i)).toBeInTheDocument();
    expect(screen.getByText(/invite: succeeded/i)).toBeInTheDocument();
    expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
  });

  it("surfaces a partial-failure warning and the failure message when a step failed", () => {
    const response: OnboardTenantResponse = {
      tenant: {
        id: "t1",
        slug: "acme",
        name: "Acme Inc",
        plan: "starter",
        status: "active",
        schemaName: "tenant_acme",
        adminSeedStatus: "failed",
        inviteStatus: "skipped",
      },
      adminSeed: { status: "failed", message: "email already registered" },
      invite: { status: "skipped" },
    };

    render(<ProvisioningResultCard result={response} />);

    // The tenant is still active even though a downstream step failed.
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/partial/i)).toBeInTheDocument();
    expect(screen.getByText(/admin seed: failed/i)).toBeInTheDocument();
    expect(screen.getByText("email already registered")).toBeInTheDocument();
    expect(screen.getByText(/invite: skipped/i)).toBeInTheDocument();
  });
});
