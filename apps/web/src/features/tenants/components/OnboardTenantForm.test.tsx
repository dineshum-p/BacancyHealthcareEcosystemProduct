import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardTenantForm } from "./OnboardTenantForm";

function renderForm(onSubmit = vi.fn()) {
  render(<OnboardTenantForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/clinic name/i), "Acme Clinic");
  await user.type(screen.getByLabelText(/slug/i), "acme-clinic");
  await user.type(screen.getByLabelText(/plan/i), "starter");
  await user.type(
    screen.getByLabelText(/admin email/i),
    "admin@acme.example.com",
  );
}

describe("OnboardTenantForm", () => {
  it("submits the entered values (AC1)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /onboard tenant/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Acme Clinic",
      slug: "acme-clinic",
      plan: "starter",
      adminEmail: "admin@acme.example.com",
    });
  });

  it("rejects an invalid slug without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/clinic name/i), "Acme Clinic");
    await user.type(screen.getByLabelText(/slug/i), "Not A Slug!");
    await user.type(screen.getByLabelText(/plan/i), "starter");
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
    await user.type(screen.getByLabelText(/plan/i), "starter");
    await user.type(screen.getByLabelText(/admin email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /onboard tenant/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", () => {
    render(<OnboardTenantForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(screen.getByRole("button", { name: /onboarding/i })).toBeDisabled();
  });
});
