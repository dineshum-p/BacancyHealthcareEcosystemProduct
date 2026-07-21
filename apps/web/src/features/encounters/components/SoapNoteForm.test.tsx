import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SoapNoteForm } from "./SoapNoteForm";

function renderForm(onSubmit = vi.fn()) {
  render(<SoapNoteForm onSubmit={onSubmit} isSubmitting={false} />);
  return { onSubmit };
}

async function fillRequiredSoapFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/subjective/i), "Patient reports headache.");
  await user.type(screen.getByLabelText(/objective/i), "Alert and oriented.");
  await user.type(screen.getByLabelText(/assessment/i), "Tension headache.");
  await user.type(screen.getByLabelText(/^plan/i), "OTC analgesic, follow up in a week.");
}

describe("SoapNoteForm (BAC-20)", () => {
  it("submits only the SOAP note when vitals and allergies are left blank (AC1)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredSoapFields(user);
    await user.click(screen.getByRole("button", { name: /sign & save note/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      soapNote: {
        subjective: "Patient reports headache.",
        objective: "Alert and oriented.",
        assessment: "Tension headache.",
        plan: "OTC analgesic, follow up in a week.",
      },
    });
  });

  it("rejects missing required SOAP fields without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole("button", { name: /sign & save note/i }));

    expect(await screen.findByText(/subjective is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("includes vitals when provided, mirroring the API's ranges (AC2)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredSoapFields(user);
    await user.type(screen.getByLabelText(/heart rate/i), "72");
    await user.type(screen.getByLabelText(/spo2/i), "98");
    await user.click(screen.getByRole("button", { name: /sign & save note/i }));

    expect(onSubmit.mock.calls[0][0]).toEqual({
      soapNote: {
        subjective: "Patient reports headache.",
        objective: "Alert and oriented.",
        assessment: "Tension headache.",
        plan: "OTC analgesic, follow up in a week.",
      },
      vitals: { heartRate: 72, spO2: 98 },
    });
  });

  it("rejects an out-of-range vital without calling onSubmit, mirroring the API's ranges (AC2/AC3)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredSoapFields(user);
    await user.type(screen.getByLabelText(/heart rate/i), "900");
    await user.click(screen.getByRole("button", { name: /sign & save note/i }));

    expect(
      await screen.findByText(/heart rate must be between 30 and 250/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("includes an allergy list entry when added and filled in (AC2)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredSoapFields(user);
    await user.click(screen.getByRole("button", { name: /add allergy/i }));
    await user.type(screen.getByLabelText(/substance/i), "Penicillin");
    await user.selectOptions(screen.getByLabelText(/severity/i), "severe");
    await user.click(screen.getByRole("button", { name: /sign & save note/i }));

    expect(onSubmit.mock.calls[0][0]).toEqual({
      soapNote: {
        subjective: "Patient reports headache.",
        objective: "Alert and oriented.",
        assessment: "Tension headache.",
        plan: "OTC analgesic, follow up in a week.",
      },
      allergies: [{ substance: "Penicillin", severity: "severe" }],
    });
  });

  it("rejects an allergy entry with no substance without calling onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredSoapFields(user);
    await user.click(screen.getByRole("button", { name: /add allergy/i }));
    await user.click(screen.getByRole("button", { name: /sign & save note/i }));

    expect(await screen.findByText(/substance is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", () => {
    render(<SoapNoteForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(
      screen.getByRole("button", { name: /signing/i }),
    ).toBeDisabled();
  });
});
