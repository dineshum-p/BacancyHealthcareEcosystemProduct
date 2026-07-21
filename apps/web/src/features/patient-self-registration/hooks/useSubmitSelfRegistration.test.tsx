import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SelfRegistrationReceipt } from "@hep/shared-types";
import * as selfRegistrationsApi from "@/src/lib/api/selfRegistrationsApi";
import { useSubmitSelfRegistration } from "./useSubmitSelfRegistration";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const RECEIPT: SelfRegistrationReceipt = {
  id: "reg-1",
  tenantId: "tenant-1",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function Probe({ tenantSlug }: { tenantSlug: string }) {
  const mutation = useSubmitSelfRegistration(tenantSlug);
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            firstName: "Jane",
            lastName: "Doe",
            dateOfBirth: "1990-05-12",
          })
        }
      >
        submit
      </button>
      {mutation.isSuccess && <div>status:{mutation.data.status}</div>}
      {mutation.isError && (
        <div>
          {mutation.error instanceof Error ? mutation.error.message : "failed"}
        </div>
      )}
    </div>
  );
}

describe("useSubmitSelfRegistration (BAC-37)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits to the given tenant slug and exposes the pending receipt (no MRN)", async () => {
    vi.spyOn(selfRegistrationsApi, "submitSelfRegistration").mockResolvedValue(
      RECEIPT,
    );

    renderWithClient(<Probe tenantSlug="acme" />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("status:pending")).toBeInTheDocument();
    expect(selfRegistrationsApi.submitSelfRegistration).toHaveBeenCalledWith(
      "acme",
      { firstName: "Jane", lastName: "Doe", dateOfBirth: "1990-05-12" },
    );
  });

  it("surfaces a submission failure", async () => {
    vi.spyOn(selfRegistrationsApi, "submitSelfRegistration").mockRejectedValue(
      new Error("Too many requests"),
    );

    renderWithClient(<Probe tenantSlug="acme" />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
  });
});
