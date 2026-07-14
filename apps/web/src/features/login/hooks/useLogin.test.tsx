import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthTokens, MfaChallenge } from "@hep/shared-types";
import * as authApi from "@/src/lib/api/authApi";
import { useLogin } from "./useLogin";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe() {
  const mutation = useLogin();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            tenantId: "acme",
            email: "admin@acme.example.com",
            password: "s3cret!!",
          })
        }
      >
        submit
      </button>
      {mutation.isPending && <div>submitting</div>}
      {mutation.isSuccess && (
        <div>
          {"mfaRequired" in mutation.data
            ? "mfa-required"
            : `tokens:${mutation.data.accessToken}`}
        </div>
      )}
      {mutation.isError && <div>failed</div>}
    </div>
  );
}

describe("useLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls authApi.login with the form input and exposes AuthTokens (AC1)", async () => {
    const tokens: AuthTokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    };
    vi.spyOn(authApi, "login").mockResolvedValue(tokens);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("tokens:access-token")).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith("acme", {
      email: "admin@acme.example.com",
      password: "s3cret!!",
    });
  });

  it("exposes an mfa_required challenge (AC2)", async () => {
    const challenge: MfaChallenge = {
      mfaRequired: true,
      mfaChallengeToken: "challenge-token",
    };
    vi.spyOn(authApi, "login").mockResolvedValue(challenge);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("mfa-required")).toBeInTheDocument();
  });

  it("surfaces a login failure (AC3)", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(
      new Error("Invalid email or password."),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("failed")).toBeInTheDocument();
  });
});
