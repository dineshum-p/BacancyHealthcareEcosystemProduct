import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthTokens, RegisteredUser } from "@hep/shared-types";
import { getStoredAccessToken, getStoredRefreshToken } from "@/src/lib/auth/session";
import * as useLoginModule from "@/src/features/login/hooks/useLogin";
import * as useSignUpPatientModule from "./hooks/useSignUpPatient";
import { PatientSignUpPage } from "./PatientSignUpPage";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

type FakeMutate<TResult> = (
  input: unknown,
  options?: {
    onSuccess?: (result: TResult) => void;
    onError?: (error: Error) => void;
  },
) => void;

function mockUseSignUpPatient(
  overrides: Partial<
    Omit<ReturnType<typeof useSignUpPatientModule.useSignUpPatient>, "mutate">
  > & { mutate?: FakeMutate<RegisteredUser> },
) {
  const mutate = overrides.mutate ?? vi.fn();
  vi.spyOn(useSignUpPatientModule, "useSignUpPatient").mockReturnValue({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
    mutate,
  } as unknown as ReturnType<typeof useSignUpPatientModule.useSignUpPatient>);
  return mutate;
}

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

async function fillAndSubmitSignUp(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/workspace/i), "acme");
  await user.type(screen.getByLabelText(/first name/i), "New");
  await user.type(screen.getByLabelText(/last name/i), "Patient");
  await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
  await user.type(screen.getByLabelText(/email/i), "new.patient@acme.example.com");
  await user.type(screen.getByLabelText(/password/i), "s3cret!!");
  await user.click(screen.getByRole("button", { name: /sign up/i }));
}

describe("PatientSignUpPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the entered fields to the sign-up mutation", async () => {
    const user = userEvent.setup();
    const signUpMutate = mockUseSignUpPatient({});
    mockUseLogin({});

    render(<PatientSignUpPage />);
    await fillAndSubmitSignUp(user);

    expect(signUpMutate).toHaveBeenCalledWith(
      {
        tenantId: "acme",
        firstName: "New",
        lastName: "Patient",
        dateOfBirth: "1990-01-01",
        email: "new.patient@acme.example.com",
        password: "s3cret!!",
      },
      expect.any(Object),
    );
  });

  it("auto-signs-in with the same credentials after a successful sign-up, then redirects (chosen UX)", async () => {
    const user = userEvent.setup();
    const created: RegisteredUser = {
      id: "u1",
      email: "new.patient@acme.example.com",
      role: "patient",
      createdAt: "2026-07-21T00:00:00.000Z",
    };
    const signUpMutate = vi.fn(
      (
        _input: unknown,
        options?: { onSuccess?: (result: RegisteredUser) => void },
      ) => {
        options?.onSuccess?.(created);
      },
    );
    mockUseSignUpPatient({ mutate: signUpMutate });

    const tokens: AuthTokens = {
      accessToken: fakeJwt({ userId: "u1", tenantId: "t1", role: "patient" }),
      refreshToken: "refresh-token",
      expiresIn: 900,
    };
    const loginMutate = vi.fn(
      (
        _input: unknown,
        options?: { onSuccess?: (result: AuthTokens) => void },
      ) => {
        options?.onSuccess?.(tokens);
      },
    );
    mockUseLogin({ mutate: loginMutate });

    render(<PatientSignUpPage />);
    await fillAndSubmitSignUp(user);

    expect(loginMutate).toHaveBeenCalledWith(
      {
        tenantId: "acme",
        email: "new.patient@acme.example.com",
        password: "s3cret!!",
      },
      expect.any(Object),
    );
    expect(getStoredAccessToken()).toBe(tokens.accessToken);
    expect(getStoredRefreshToken()).toBe(tokens.refreshToken);
    expect(replace).toHaveBeenCalledWith("/patients");
  });

  it("shows a duplicate-email error and does not attempt auto-login (409)", async () => {
    const user = userEvent.setup();
    mockUseSignUpPatient({
      isError: true,
      error: new Error("An account with this email already exists."),
    });
    const loginMutate = mockUseLogin({});

    render(<PatientSignUpPage />);
    await fillAndSubmitSignUp(user);

    expect(
      screen.getByText("An account with this email already exists."),
    ).toBeInTheDocument();
    expect(loginMutate).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("falls back to a manual sign-in prompt if auto-login fails after a successful sign-up", async () => {
    const user = userEvent.setup();
    const created: RegisteredUser = {
      id: "u1",
      email: "new.patient@acme.example.com",
      role: "patient",
      createdAt: "2026-07-21T00:00:00.000Z",
    };
    const signUpMutate = vi.fn(
      (
        _input: unknown,
        options?: { onSuccess?: (result: RegisteredUser) => void },
      ) => {
        options?.onSuccess?.(created);
      },
    );
    mockUseSignUpPatient({ mutate: signUpMutate });

    const loginMutate = vi.fn(
      (
        _input: unknown,
        options?: { onError?: (error: Error) => void },
      ) => {
        options?.onError?.(new Error("Something went wrong."));
      },
    );
    mockUseLogin({ mutate: loginMutate });

    render(<PatientSignUpPage />);
    await fillAndSubmitSignUp(user);

    expect(
      await screen.findByText(/account created/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login");
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a loading state while the sign-up submission is pending", () => {
    mockUseSignUpPatient({ isPending: true });
    mockUseLogin({});

    render(<PatientSignUpPage />);

    expect(
      screen.getByRole("button", { name: /signing up/i }),
    ).toBeDisabled();
  });

  it("pre-fills the workspace field from initialTenantSlug (BAC-38 pattern)", () => {
    mockUseSignUpPatient({});
    mockUseLogin({});

    render(<PatientSignUpPage initialTenantSlug="acme-clinic" />);

    expect(screen.getByLabelText(/workspace/i)).toHaveValue("acme-clinic");
  });

  it("links back to the login page", () => {
    mockUseSignUpPatient({});
    mockUseLogin({});

    render(<PatientSignUpPage />);

    expect(
      screen.getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login");
  });
});
