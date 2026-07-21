import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisitIntakeRequestForm } from "./VisitIntakeRequestForm";

describe("VisitIntakeRequestForm (BAC-47, AC1)", () => {
  it("requires reasonForVisit and symptoms before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<VisitIntakeRequestForm onSubmit={onSubmit} isSubmitting={false} />);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/reason for visit is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/symptoms are required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits reasonForVisit/symptoms/whatsNewSinceLastVisit (AC1)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<VisitIntakeRequestForm onSubmit={onSubmit} isSubmitting={false} />);
    await user.type(
      screen.getByLabelText(/reason for visit/i),
      "Persistent cough",
    );
    await user.type(
      screen.getByLabelText(/^symptoms$/i),
      "Coughing for 3 days, mild fever",
    );
    await user.type(
      screen.getByLabelText(/anything new since your last visit/i),
      "Started a new job",
    );
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      reasonForVisit: "Persistent cough",
      symptoms: "Coughing for 3 days, mild fever",
      whatsNewSinceLastVisit: "Started a new job",
    });
  });

  it("omits whatsNewSinceLastVisit from the request when left blank (optional field)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<VisitIntakeRequestForm onSubmit={onSubmit} isSubmitting={false} />);
    await user.type(screen.getByLabelText(/reason for visit/i), "Checkup");
    await user.type(screen.getByLabelText(/^symptoms$/i), "None currently");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      reasonForVisit: "Checkup",
      symptoms: "None currently",
    });
  });

  it("shows a submitting state and disables the submit button", () => {
    render(<VisitIntakeRequestForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
  });
});
