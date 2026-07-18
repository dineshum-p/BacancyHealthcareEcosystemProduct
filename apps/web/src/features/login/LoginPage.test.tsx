import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthTokens, MfaChallenge } from "@hep/shared-types";
import {
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredAccessToken,
} from "@/src/lib/auth/session";
import * as useLoginModule from "./hooks/useLogin";
import * as useVerifyMfaLoginModule from "./hooks/useVerifyMfaLogin";
import { LoginPage } from "./LoginPage";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

/**
 * Test-only stand-in for a mutation's `mutate` -- narrower than TanStack
 * Query's real `UseMutateFunction` (which also passes `variables`/
 * `onMutateResult`/`context` to `onSuccess`), since these tests only ever
 * need `onSuccess`'s first argument (the resolved data).
 */
type FakeMutate<TResult> = (
  input: unknown,
  options?: { onSuccess?: (result: TResult) => void },
) => void;

function mockUseLogin(
  overrides: Partial<
    Omit<ReturnType<typeof useLoginModule.useLogin>, "mutate">
  > & { mutate?: FakeMutate<import("@hep/shared-types").LoginResult> },
) {
  const mutate = overrides.mutate ?? vi.fn();
  vi.spyOn(useLoginModule, "useLogin").mockReturnValue({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
    mutate,
  } as unknown as ReturnType<typeof useLoginModule.useLogin>);
  return mutate;
}

function mockUseVerifyMfaLogin(
  overrides: Partial<
    Omit<ReturnType<typeof useVerifyMfaLoginModule.useVerifyMfaLogin>, "mutate">
  > & { mutate?: FakeMutate<import("@hep/shared-types").AuthTokens> },
) {
  const mutate = overrides.mutate ?? vi.fn();
  vi.spyOn(useVerifyMfaLoginModule, "useVerifyMfaLogin").mockReturnValue({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
    mutate,
  } as unknown as ReturnType<typeof useVerifyMfaLoginModule.useVerifyMfaLogin>);
  return mutate;
}

async function fillAndSubmitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/workspace/i), "acme");
  await user.type(screen.getByLabelText(/email/i), "admin@acme.example.com");
  await user.type(screen.getByLabelText(/password/i), "s3cret!!");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects an already-authenticated caller to their dashboard instead of showing the form (AC4)", () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "super_admin" }),
    );
    mockUseLogin({});
    mockUseVerifyMfaLogin({});

    render(<LoginPage />);

    expect(replace).toHaveBeenCalledWith("/admin/tenants");
    expect(screen.queryByLabelText(/workspace/i)).not.toBeInTheDocument();
  });

  it("treats a caller whose stored token has expired as unauthenticated and shows the login form (AC4 regression, BAC-13)", () => {
    setStoredAccessToken(
      fakeJwt({
        userId: "u1",
        tenantId: "t1",
        role: "super_admin",
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
    );
    mockUseLogin({});
    mockUseVerifyMfaLogin({});

    render(<LoginPage />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument();
  });

  describe("as an unauthenticated caller", () => {
    it("submits credentials to the login mutation (AC1)", async () => {
      const user = userEvent.setup();
      const mutate = mockUseLogin({});
      mockUseVerifyMfaLogin({});

      render(<LoginPage />);
      await fillAndSubmitLogin(user);

      expect(mutate).toHaveBeenCalledWith(
        {
          tenantId: "acme",
          email: "admin@acme.example.com",
          password: "s3cret!!",
        },
        expect.any(Object),
      );
    });

    it("stores tokens and redirects when the login mutation succeeds directly (AC1)", async () => {
      const user = userEvent.setup();
      const tokens: AuthTokens = {
        accessToken: fakeJwt({
          userId: "u1",
          tenantId: "t1",
          role: "super_admin",
        }),
        refreshToken: "refresh-token",
        expiresIn: 900,
      };
      const mutate = vi.fn(
        (
          _input: unknown,
          options?: { onSuccess?: (result: AuthTokens) => void },
        ) => {
          options?.onSuccess?.(tokens);
        },
      );
      mockUseLogin({ mutate });
      mockUseVerifyMfaLogin({});

      render(<LoginPage />);
      await fillAndSubmitLogin(user);

      expect(getStoredAccessToken()).toBe(tokens.accessToken);
      expect(getStoredRefreshToken()).toBe(tokens.refreshToken);
      expect(replace).toHaveBeenCalledWith("/admin/tenants");
    });

    it("shows the MFA step when the login mutation returns an mfa_required challenge (AC2)", async () => {
      const user = userEvent.setup();
      const challenge: MfaChallenge = {
        mfaRequired: true,
        mfaChallengeToken: "challenge-token",
      };
      const mutate = vi.fn(
        (
          _input: unknown,
          options?: { onSuccess?: (result: MfaChallenge) => void },
        ) => {
          options?.onSuccess?.(challenge);
        },
      );
      mockUseLogin({ mutate });
      mockUseVerifyMfaLogin({});

      render(<LoginPage />);
      await fillAndSubmitLogin(user);

      expect(
        await screen.findByLabelText(/authentication code/i),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/workspace/i)).not.toBeInTheDocument();
    });

    it("completes login after a valid TOTP code (AC2)", async () => {
      const user = userEvent.setup();
      const challenge: MfaChallenge = {
        mfaRequired: true,
        mfaChallengeToken: "challenge-token",
      };
      const loginMutate = vi.fn(
        (
          _input: unknown,
          options?: { onSuccess?: (result: MfaChallenge) => void },
        ) => {
          options?.onSuccess?.(challenge);
        },
      );
      mockUseLogin({ mutate: loginMutate });

      const tokens: AuthTokens = {
        accessToken: fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
        refreshToken: "refresh-token",
        expiresIn: 900,
      };
      const verifyMutate = vi.fn(
        (
          _input: unknown,
          options?: { onSuccess?: (result: AuthTokens) => void },
        ) => {
          options?.onSuccess?.(tokens);
        },
      );
      mockUseVerifyMfaLogin({ mutate: verifyMutate });

      render(<LoginPage />);
      await fillAndSubmitLogin(user);
      await user.type(
        await screen.findByLabelText(/authentication code/i),
        "123456",
      );
      await user.click(screen.getByRole("button", { name: /verify/i }));

      expect(verifyMutate).toHaveBeenCalledWith(
        {
          tenantId: "acme",
          mfaChallengeToken: "challenge-token",
          totpCode: "123456",
        },
        expect.any(Object),
      );
      expect(getStoredAccessToken()).toBe(tokens.accessToken);
      expect(replace).toHaveBeenCalledWith("/patients");
    });

    it("shows an inline error for invalid credentials and stays on the page (AC3)", () => {
      mockUseLogin({
        isError: true,
        error: new Error("Invalid email or password."),
      });
      mockUseVerifyMfaLogin({});

      render(<LoginPage />);

      expect(
        screen.getByText("Invalid email or password."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("shows a loading state while the login submission is pending (AC4)", () => {
      mockUseLogin({ isPending: true });
      mockUseVerifyMfaLogin({});

      render(<LoginPage />);

      expect(
        screen.getByRole("button", { name: /signing in/i }),
      ).toBeDisabled();
    });
  });
});
