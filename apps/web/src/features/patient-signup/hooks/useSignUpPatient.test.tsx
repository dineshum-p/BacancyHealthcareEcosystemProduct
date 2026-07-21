import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RegisteredUser } from "@hep/shared-types";
import * as authApi from "@/src/lib/api/authApi";
import { useSignUpPatient } from "./useSignUpPatient";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe() {
  const mutation = useSignUpPatient();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            tenantId: "acme",
            email: "new.patient@acme.example.com",
            password: "s3cret!!",
            firstName: "New",
            lastName: "Patient",
            dateOfBirth: "1990-01-01",
          })
        }
      >
        submit
      </button>
      {mutation.isPending && <div>submitting</div>}
      {mutation.isSuccess && <div>created:{mutation.data.id}</div>}
      {mutation.isError && (
        <div>
          failed:{mutation.error instanceof Error ? mutation.error.message : ""}
        </div>
      )}
    </div>
  );
}

describe("useSignUpPatient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls authApi.registerPatient with the tenant header and sign-up fields (BAC-43)", async () => {
    const created: RegisteredUser = {
      id: "u1",
      email: "new.patient@acme.example.com",
      role: "patient",
      createdAt: "2026-07-21T00:00:00.000Z",
    };
    vi.spyOn(authApi, "registerPatient").mockResolvedValue(created);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("created:u1")).toBeInTheDocument();
    expect(authApi.registerPatient).toHaveBeenCalledWith("acme", {
      email: "new.patient@acme.example.com",
      password: "s3cret!!",
      firstName: "New",
      lastName: "Patient",
      dateOfBirth: "1990-01-01",
    });
  });

  it("surfaces a sign-up failure, e.g. a duplicate email (409)", async () => {
    vi.spyOn(authApi, "registerPatient").mockRejectedValue(
      new Error("An account with this email already exists."),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(
      await screen.findByText(
        "failed:An account with this email already exists.",
      ),
    ).toBeInTheDocument();
  });
});
