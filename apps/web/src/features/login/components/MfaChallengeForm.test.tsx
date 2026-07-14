import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MfaChallengeForm } from "./MfaChallengeForm";

function renderForm(onSubmit = vi.fn()) {
  render(<MfaChallengeForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

describe("MfaChallengeForm", () => {
  it("submits the entered 6-digit code (AC2)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/authentication code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("123456");
  });

  it("rejects a code that isn't 6 digits without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/authentication code/i), "12a45");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/6-digit code/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting (AC4)", () => {
    render(<MfaChallengeForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(screen.getByRole("button", { name: /verifying/i })).toBeDisabled();
  });
});
