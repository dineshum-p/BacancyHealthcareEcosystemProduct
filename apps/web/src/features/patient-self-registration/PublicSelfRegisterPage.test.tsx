import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SelfRegistrationReceipt } from "@hep/shared-types";
import * as useSubmitSelfRegistrationModule from "./hooks/useSubmitSelfRegistration";
import { PublicSelfRegisterPage } from "./PublicSelfRegisterPage";

function renderPage(tenantSlug = "acme") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PublicSelfRegisterPage tenantSlug={tenantSlug} />
    </QueryClientProvider>,
  );
}

function mockUseSubmit(
  overrides: Partial<
    ReturnType<typeof useSubmitSelfRegistrationModule.useSubmitSelfRegistration>
  >,
) {
  const mutate = vi.fn();
  vi.spyOn(
    useSubmitSelfRegistrationModule,
    "useSubmitSelfRegistration",
  ).mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  } as ReturnType<
    typeof useSubmitSelfRegistrationModule.useSubmitSelfRegistration
  >);
  return mutate;
}

const RECEIPT: SelfRegistrationReceipt = {
  id: "reg-1",
  tenantId: "tenant-1",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("PublicSelfRegisterPage (BAC-37)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the form with no login/authentication check at all -- genuinely public", () => {
    mockUseSubmit({});

    renderPage();

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.queryByText(/not authorized/i)).not.toBeInTheDocument();
  });

  it("submits the form to the mutation for the tenant slug from the route", async () => {
    const user = userEvent.setup();
    const mutate = mockUseSubmit({});

    renderPage("acme");
    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.click(
      screen.getByRole("button", { name: /submit registration/i }),
    );

    expect(mutate).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1990-05-12",
    });
  });

  it("shows a pending-review confirmation on success -- NEVER an MRN", () => {
    mockUseSubmit({ isSuccess: true, data: RECEIPT });

    renderPage();

    expect(screen.getByText(/pending clinic review/i)).toBeInTheDocument();
    expect(screen.queryByText(/mrn/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  });

  it("shows an error message while keeping the form visible on failure", () => {
    mockUseSubmit({
      isError: true,
      error: new Error("Too many requests"),
    });

    renderPage();

    expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });
});
