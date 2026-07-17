import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterPatientForm } from "./RegisterPatientForm";

function renderForm(onSubmit = vi.fn()) {
  render(<RegisterPatientForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

describe("RegisterPatientForm", () => {
  it("submits only the required demographics when optional fields are left blank (AC1)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.click(screen.getByRole("button", { name: /register patient/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1990-05-12",
    });
  });

  it("includes gender/phone/email when provided", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.selectOptions(screen.getByLabelText(/gender/i), "female");
    await user.type(screen.getByLabelText(/phone/i), "555-0100");
    await user.type(screen.getByLabelText(/^email/i), "jane.doe@example.com");
    await user.click(screen.getByRole("button", { name: /register patient/i }));

    expect(onSubmit.mock.calls[0][0]).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1990-05-12",
      gender: "female",
      phone: "555-0100",
      email: "jane.doe@example.com",
    });
  });

  it("rejects a missing first name without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.click(screen.getByRole("button", { name: /register patient/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.type(screen.getByLabelText(/^email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /register patient/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves entered values when re-rendered after a failed submission (AC3)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <RegisterPatientForm onSubmit={onSubmit} isSubmitting={false} />,
    );

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.click(screen.getByRole("button", { name: /register patient/i }));

    // Simulate the parent re-rendering with a submission error surfaced
    // alongside the form (AC3): the form itself must not clear its fields.
    rerender(
      <RegisterPatientForm onSubmit={onSubmit} isSubmitting={false} />,
    );

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Jane");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Doe");
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue("1990-05-12");
  });

  it("disables the submit button while submitting", () => {
    render(<RegisterPatientForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(
      screen.getByRole("button", { name: /registering/i }),
    ).toBeDisabled();
  });
});
