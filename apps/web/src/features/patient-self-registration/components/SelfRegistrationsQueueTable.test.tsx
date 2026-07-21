import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PatientSelfRegistrationSummary } from "@hep/shared-types";
import { SelfRegistrationsQueueTable } from "./SelfRegistrationsQueueTable";

const PENDING: PatientSelfRegistrationSummary = {
  id: "reg-1",
  tenantId: "tenant-1",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: null,
  phone: null,
  email: null,
  status: "pending",
  matchedPatientId: null,
  matchReason: null,
  resultingPatientId: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const DUPLICATE_FLAGGED: PatientSelfRegistrationSummary = {
  ...PENDING,
  id: "reg-2",
  firstName: "John",
  matchedPatientId: "patient-1",
  matchReason: "name_dob",
};

describe("SelfRegistrationsQueueTable (BAC-37)", () => {
  it("renders one row per pending self-registration", () => {
    render(
      <SelfRegistrationsQueueTable
        registrations={[PENDING]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMerge={vi.fn()}
        actioningId={null}
      />,
    );

    expect(screen.getByText("Doe, Jane")).toBeInTheDocument();
  });

  it("flags a probable duplicate WITHOUT exposing any other patient's details", () => {
    render(
      <SelfRegistrationsQueueTable
        registrations={[DUPLICATE_FLAGGED]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMerge={vi.fn()}
        actioningId={null}
      />,
    );

    expect(screen.getByText(/possible duplicate/i)).toBeInTheDocument();
    // Never renders the matched patient's id/name/demographics -- only that
    // this entry needs a closer look.
    expect(screen.queryByText("patient-1")).not.toBeInTheDocument();
  });

  it("calls onApprove with the registration id", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <SelfRegistrationsQueueTable
        registrations={[PENDING]}
        onApprove={onApprove}
        onReject={vi.fn()}
        onMerge={vi.fn()}
        actioningId={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /approve/i }));

    expect(onApprove).toHaveBeenCalledWith("reg-1");
  });

  it("calls onReject with the registration id", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(
      <SelfRegistrationsQueueTable
        registrations={[PENDING]}
        onApprove={vi.fn()}
        onReject={onReject}
        onMerge={vi.fn()}
        actioningId={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^reject$/i }));

    expect(onReject).toHaveBeenCalledWith("reg-1");
  });

  it("calls onMerge with the registration id and the entered target patient id", async () => {
    const user = userEvent.setup();
    const onMerge = vi.fn();
    render(
      <SelfRegistrationsQueueTable
        registrations={[DUPLICATE_FLAGGED]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMerge={onMerge}
        actioningId={null}
      />,
    );

    // Defaults to the flagged candidate, but staff may override it.
    expect(screen.getByLabelText(/target patient id/i)).toHaveValue(
      "patient-1",
    );
    await user.click(screen.getByRole("button", { name: /^merge$/i }));

    expect(onMerge).toHaveBeenCalledWith("reg-2", "patient-1");
  });

  it("disables every action for the row currently being actioned", () => {
    render(
      <SelfRegistrationsQueueTable
        registrations={[PENDING]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMerge={vi.fn()}
        actioningId="reg-1"
      />,
    );

    expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^merge$/i })).toBeDisabled();
  });
});
