import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

function renderForm(onSubmit = vi.fn()) {
  render(<LoginForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/workspace/i), "acme");
  await user.type(screen.getByLabelText(/email/i), "admin@acme.example.com");
  await user.type(screen.getByLabelText(/password/i), "s3cret!!");
}

describe("LoginForm", () => {
  it("submits the entered credentials (AC1)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      tenantId: "acme",
      email: "admin@acme.example.com",
      password: "s3cret!!",
    });
  });

  it("rejects a missing workspace without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/email/i), "admin@acme.example.com");
    await user.type(screen.getByLabelText(/password/i), "s3cret!!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/workspace is required/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/workspace/i), "acme");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "s3cret!!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a missing password without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/workspace/i), "acme");
    await user.type(screen.getByLabelText(/email/i), "admin@acme.example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/password is required/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting (AC4)", () => {
    render(<LoginForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("pre-fills the workspace field when defaultTenantId is given (BAC-38: subdomain-resolved tenant)", () => {
    render(
      <LoginForm onSubmit={vi.fn()} isSubmitting={false} defaultTenantId="acme-clinic" />,
    );

    expect(screen.getByLabelText(/workspace/i)).toHaveValue("acme-clinic");
  });
});
