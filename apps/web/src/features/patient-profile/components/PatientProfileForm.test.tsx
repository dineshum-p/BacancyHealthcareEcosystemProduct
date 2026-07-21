import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PatientProfileResponse } from "@hep/shared-types";
import { PatientProfileForm } from "./PatientProfileForm";

const PROFILE: PatientProfileResponse = {
  id: "profile-1",
  patientId: "patient-1",
  tenantId: "tenant-1",
  hasProfile: true,
  demographics: {
    firstName: "Ada",
    lastName: "Lovelace",
    dateOfBirth: "1990-01-01",
  },
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  chronicConditions: [{ name: "Asthma" }],
  medications: [{ name: "Albuterol", dosage: "90mcg" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const EMPTY_PROFILE: PatientProfileResponse = {
  id: null,
  patientId: "patient-1",
  tenantId: "tenant-1",
  hasProfile: false,
  demographics: { firstName: null, lastName: null, dateOfBirth: null },
  allergies: [],
  chronicConditions: [],
  medications: [],
  createdAt: null,
  updatedAt: null,
};

describe("PatientProfileForm", () => {
  it("renders the read-only demographics from the profile (AC1)", () => {
    render(
      <PatientProfileForm
        profile={PROFILE}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Lovelace")).toBeInTheDocument();
    expect(screen.getByText("1990-01-01")).toBeInTheDocument();
  });

  it("pre-fills allergies/chronic conditions/medications from the profile (AC1)", () => {
    render(
      <PatientProfileForm
        profile={PROFILE}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.getByDisplayValue("Penicillin")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Asthma")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Albuterol")).toBeInTheDocument();
  });

  it("shows a friendly empty state per section when hasProfile is false (AC1)", () => {
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.getAllByText(/no .* added yet/i).length).toBeGreaterThan(0);
  });

  it("adds a new allergy row and submits the full, edited profile (AC2)", async () => {
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add allergy/i }));
    fireEvent.change(screen.getByLabelText(/substance/i), {
      target: { value: "Latex" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("button", { name: /save/i })).toBeEnabled();
    expect(handleSubmit).toHaveBeenCalledWith({
      allergies: [{ substance: "Latex" }],
      chronicConditions: [],
      medications: [],
    });
  });

  it("disables the save button while submitting", () => {
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={vi.fn()}
        isSubmitting={true}
      />,
    );

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("rejects an allergy entry with no substance without calling onSubmit", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add allergy/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/substance is required/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects a chronic condition entry with no name without calling onSubmit", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add condition/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText(/condition name is required/i),
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects a medication entry with no name without calling onSubmit", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add medication/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText(/medication name is required/i),
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects a chronic condition note over the backend's 500-char limit, matching chronic-condition.dto.ts (BAC-46)", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add condition/i }));
    fireEvent.change(screen.getByLabelText(/condition/i), {
      target: { value: "Asthma" },
    });
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: "a".repeat(501) },
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects a medication note over the backend's 500-char limit, matching medication.dto.ts (BAC-46)", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add medication/i }));
    fireEvent.change(screen.getByLabelText(/medication/i), {
      target: { value: "Metformin" },
    });
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: "a".repeat(501) },
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects a medication dosage over the backend's 100-char limit, matching medication.dto.ts (BAC-46)", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add medication/i }));
    fireEvent.change(screen.getByLabelText(/medication/i), {
      target: { value: "Metformin" },
    });
    fireEvent.change(screen.getByLabelText(/dosage/i), {
      target: { value: "a".repeat(101) },
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("rejects a medication frequency over the backend's 100-char limit, matching medication.dto.ts (BAC-46)", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <PatientProfileForm
        profile={EMPTY_PROFILE}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add medication/i }));
    fireEvent.change(screen.getByLabelText(/medication/i), {
      target: { value: "Metformin" },
    });
    fireEvent.change(screen.getByLabelText(/frequency/i), {
      target: { value: "a".repeat(101) },
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
