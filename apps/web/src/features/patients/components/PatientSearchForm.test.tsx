import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientSearchForm } from "./PatientSearchForm";

function renderForm(onSubmit = vi.fn()) {
  render(<PatientSearchForm onSubmit={onSubmit} />);
  return { onSubmit };
}

describe("PatientSearchForm", () => {
  it("submits only the filled filters (AC2)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/^name/i), "Jane");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Jane",
      mrn: "",
      dateOfBirth: "",
    });
  });

  it("submits every provided filter combined (AC2)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/^name/i), "Jane");
    await user.type(screen.getByLabelText(/mrn/i), "MRN-0001");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Jane",
      mrn: "MRN-0001",
      dateOfBirth: "1990-05-12",
    });
  });
});
