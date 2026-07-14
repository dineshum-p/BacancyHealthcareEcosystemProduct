import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthTokens } from "@hep/shared-types";
import * as authApi from "@/src/lib/api/authApi";
import { useVerifyMfaLogin } from "./useVerifyMfaLogin";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe() {
  const mutation = useVerifyMfaLogin();
  return (
    <div>
      <button
        onClick={() =>
          mutation.mutate({
            tenantId: "acme",
            mfaChallengeToken: "challenge-token",
            totpCode: "123456",
          })
        }
      >
        submit
      </button>
      {mutation.isPending && <div>submitting</div>}
      {mutation.isSuccess && <div>tokens:{mutation.data.accessToken}</div>}
      {mutation.isError && <div>failed</div>}
    </div>
  );
}

describe("useVerifyMfaLogin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls authApi.verifyMfaLogin with the challenge input and exposes AuthTokens (AC2)", async () => {
    const tokens: AuthTokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    };
    vi.spyOn(authApi, "verifyMfaLogin").mockResolvedValue(tokens);

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("tokens:access-token")).toBeInTheDocument();
    expect(authApi.verifyMfaLogin).toHaveBeenCalledWith("acme", {
      mfaChallengeToken: "challenge-token",
      totpCode: "123456",
    });
  });

  it("surfaces an invalid TOTP code failure (AC3)", async () => {
    vi.spyOn(authApi, "verifyMfaLogin").mockRejectedValue(
      new Error("Invalid or expired authentication code."),
    );

    renderWithClient(<Probe />);
    fireEvent.click(screen.getByText("submit"));

    expect(await screen.findByText("failed")).toBeInTheDocument();
  });
});
