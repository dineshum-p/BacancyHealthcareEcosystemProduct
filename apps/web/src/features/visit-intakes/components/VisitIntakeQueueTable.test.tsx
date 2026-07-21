import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PatientProfileResponse,
  VisitIntakeSummary,
} from "@hep/shared-types";
import * as usePatientDisplayNameModule from "../hooks/usePatientDisplayName";
import { VisitIntakeQueueTable } from "./VisitIntakeQueueTable";

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
  allergies: [],
  chronicConditions: [],
  medications: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const INTAKE: VisitIntakeSummary = {
  id: "intake-1",
  tenantId: "tenant-1",
  patientId: "patient-1",
  reasonForVisit: "Persistent cough",
  symptoms: "Coughing for 3 days",
  whatsNewSinceLastVisit: "Started a new job",
  status: "pending",
  assignedProviderId: null,
  appointmentId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("VisitIntakeQueueTable (BAC-47, AC2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the resolved patient name, reason, symptoms, and what's new", () => {
    vi.spyOn(usePatientDisplayNameModule, "usePatientDisplayName").mockReturnValue(
      { data: PROFILE, isLoading: false } as ReturnType<
        typeof usePatientDisplayNameModule.usePatientDisplayName
      >,
    );

    render(
      <VisitIntakeQueueTable
        intakes={[INTAKE]}
        onLink={vi.fn()}
        isLinking={false}
        linkingId={null}
      />,
    );

    expect(screen.getByText("Lovelace, Ada")).toBeInTheDocument();
    expect(screen.getByText("Persistent cough")).toBeInTheDocument();
    expect(screen.getByText("Coughing for 3 days")).toBeInTheDocument();
    expect(screen.getByText("Started a new job")).toBeInTheDocument();
  });

  it("falls back to '(name unavailable)' when the profile lookup has no name on file", () => {
    vi.spyOn(usePatientDisplayNameModule, "usePatientDisplayName").mockReturnValue(
      { data: undefined, isLoading: false } as ReturnType<
        typeof usePatientDisplayNameModule.usePatientDisplayName
      >,
    );

    render(
      <VisitIntakeQueueTable
        intakes={[INTAKE]}
        onLink={vi.fn()}
        isLinking={false}
        linkingId={null}
      />,
    );

    expect(screen.getByText(/name unavailable/i)).toBeInTheDocument();
  });

  it("links a 'Book appointment' path into the existing appointments/booking UI, pre-filling the patient", () => {
    vi.spyOn(usePatientDisplayNameModule, "usePatientDisplayName").mockReturnValue(
      { data: PROFILE, isLoading: false } as ReturnType<
        typeof usePatientDisplayNameModule.usePatientDisplayName
      >,
    );

    render(
      <VisitIntakeQueueTable
        intakes={[INTAKE]}
        onLink={vi.fn()}
        isLinking={false}
        linkingId={null}
      />,
    );

    const link = screen.getByRole("link", { name: /book appointment/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/appointments?"));
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("patientId=patient-1"),
    );
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("patientName=Ada+Lovelace"),
    );
  });

  it("submits the 'mark as booked' link form with providerId + appointmentId", async () => {
    const user = userEvent.setup();
    vi.spyOn(usePatientDisplayNameModule, "usePatientDisplayName").mockReturnValue(
      { data: PROFILE, isLoading: false } as ReturnType<
        typeof usePatientDisplayNameModule.usePatientDisplayName
      >,
    );
    const onLink = vi.fn();

    render(
      <VisitIntakeQueueTable
        intakes={[INTAKE]}
        onLink={onLink}
        isLinking={false}
        linkingId={null}
      />,
    );

    await user.type(screen.getByLabelText(/provider id/i), "provider-1");
    await user.type(screen.getByLabelText(/appointment id/i), "appt-1");
    await user.click(screen.getByRole("button", { name: /mark as booked/i }));

    expect(onLink).toHaveBeenCalledWith("intake-1", {
      providerId: "provider-1",
      appointmentId: "appt-1",
    });
  });
});
