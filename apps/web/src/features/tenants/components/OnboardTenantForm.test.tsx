import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PricingQuote } from "@hep/shared-types";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import { OnboardTenantForm } from "./OnboardTenantForm";

/**
 * A well-formed (but unsigned) 3-part JWT carrying the `tenantId` claim
 * `pricingApi.buildAuthHeaders` reads. Decoding is client-side/untrusted, so
 * the signature never has to be real for the auth header to be built.
 */
function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

const PRICING_QUOTE: PricingQuote = {
  modules: ["clinic"],
  planTier: "starter",
  lineItems: [],
  onboardingSubtotal: 0,
  discountRate: 0,
  discountAmount: 0,
  onboardingTotal: 0,
  monthlyPlatformFee: 0,
};

/**
 * The form calls `usePricingQuote` (TanStack Query) once a module is selected,
 * so every render needs a QueryClientProvider; a fresh client per render keeps
 * tests isolated.
 */
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function renderForm(onSubmit = vi.fn()) {
  renderWithClient(<OnboardTenantForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

describe("OnboardTenantForm", () => {
  beforeEach(() => {
    // The pricing quote sits behind the same super_admin guard chain, so
    // buildAuthHeaders needs a stored token; the fetch itself is stubbed so
    // the live pricing call never leaves the test.
    setStoredAccessToken(
      fakeJwt({ userId: "user-1", tenantId: "tenant-1", role: "super_admin" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(PRICING_QUOTE), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits the entered values (AC1)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/clinic name/i), "Acme Clinic");
    await user.type(screen.getByLabelText(/slug/i), "acme-clinic");
    await user.click(screen.getByRole("checkbox", { name: /clinic/i }));
    await user.selectOptions(screen.getByLabelText(/plan tier/i), "starter");
    await user.type(
      screen.getByLabelText(/admin email/i),
      "admin@acme.example.com",
    );
    await user.click(screen.getByRole("button", { name: /onboard tenant/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Acme Clinic",
      slug: "acme-clinic",
      plan: "starter",
      modules: ["clinic"],
      adminEmail: "admin@acme.example.com",
    });
  });

  it("rejects an invalid slug without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/clinic name/i), "Acme Clinic");
    await user.type(screen.getByLabelText(/slug/i), "Not A Slug!");
    await user.click(screen.getByRole("checkbox", { name: /clinic/i }));
    await user.type(
      screen.getByLabelText(/admin email/i),
      "admin@acme.example.com",
    );
    await user.click(screen.getByRole("button", { name: /onboard tenant/i }));

    expect(
      await screen.findByText(/lowercase, kebab-case/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid admin email without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/clinic name/i), "Acme Clinic");
    await user.type(screen.getByLabelText(/slug/i), "acme-clinic");
    await user.click(screen.getByRole("checkbox", { name: /clinic/i }));
    await user.type(screen.getByLabelText(/admin email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /onboard tenant/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", () => {
    renderWithClient(
      <OnboardTenantForm onSubmit={vi.fn()} isSubmitting={true} />,
    );

    expect(screen.getByRole("button", { name: /onboarding/i })).toBeDisabled();
  });
});
