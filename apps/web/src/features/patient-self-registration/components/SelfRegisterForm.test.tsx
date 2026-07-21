import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelfRegisterForm } from "./SelfRegisterForm";

function renderForm(onSubmit = vi.fn()) {
  render(<SelfRegisterForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

describe("SelfRegisterForm (BAC-37, public self-registration)", () => {
  it("submits only the required demographics when optional fields are left blank", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

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
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

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
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", () => {
    render(<SelfRegisterForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(
      screen.getByRole("button", { name: /submitting/i }),
    ).toBeDisabled();
  });

  it("never renders any field for a login/password or an MRN (public, unauthenticated form)", () => {
    renderForm();

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mrn/i)).not.toBeInTheDocument();
  });
});
