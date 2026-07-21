import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientSignUpForm } from "./PatientSignUpForm";

function renderForm(onSubmit = vi.fn()) {
  render(<PatientSignUpForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/workspace/i), "acme");
  await user.type(screen.getByLabelText(/first name/i), "New");
  await user.type(screen.getByLabelText(/last name/i), "Patient");
  await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
  await user.type(screen.getByLabelText(/email/i), "new.patient@acme.example.com");
  await user.type(screen.getByLabelText(/password/i), "s3cret!!");
}

describe("PatientSignUpForm", () => {
  it("submits the entered sign-up fields (BAC-43)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      tenantId: "acme",
      firstName: "New",
      lastName: "Patient",
      dateOfBirth: "1990-01-01",
      email: "new.patient@acme.example.com",
      password: "s3cret!!",
    });
  });

  it("rejects a missing workspace without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/first name/i), "New");
    await user.type(screen.getByLabelText(/last name/i), "Patient");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.type(screen.getByLabelText(/email/i), "new.patient@acme.example.com");
    await user.type(screen.getByLabelText(/password/i), "s3cret!!");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/workspace is required/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/workspace/i), "acme");
    await user.type(screen.getByLabelText(/first name/i), "New");
    await user.type(screen.getByLabelText(/last name/i), "Patient");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "s3cret!!");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a too-short password without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/workspace/i), "acme");
    await user.type(screen.getByLabelText(/first name/i), "New");
    await user.type(screen.getByLabelText(/last name/i), "Patient");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.type(screen.getByLabelText(/email/i), "new.patient@acme.example.com");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/at least 8 characters/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a missing first name without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/workspace/i), "acme");
    await user.type(screen.getByLabelText(/last name/i), "Patient");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await user.type(screen.getByLabelText(/email/i), "new.patient@acme.example.com");
    await user.type(screen.getByLabelText(/password/i), "s3cret!!");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/first name is required/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a missing date of birth without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/workspace/i), "acme");
    await user.type(screen.getByLabelText(/first name/i), "New");
    await user.type(screen.getByLabelText(/last name/i), "Patient");
    await user.type(screen.getByLabelText(/email/i), "new.patient@acme.example.com");
    await user.type(screen.getByLabelText(/password/i), "s3cret!!");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/date of birth is required/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", () => {
    render(<PatientSignUpForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(
      screen.getByRole("button", { name: /signing up/i }),
    ).toBeDisabled();
  });

  it("pre-fills the workspace field when defaultTenantId is given (BAC-38 pattern)", () => {
    render(
      <PatientSignUpForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        defaultTenantId="acme-clinic"
      />,
    );

    expect(screen.getByLabelText(/workspace/i)).toHaveValue("acme-clinic");
  });
});
