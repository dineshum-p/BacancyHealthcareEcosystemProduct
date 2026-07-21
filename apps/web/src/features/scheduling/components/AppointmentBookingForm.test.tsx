import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PatientSummary } from "@hep/shared-types";
import * as patientsApi from "@/src/lib/api/patientsApi";
import { AppointmentBookingForm } from "./AppointmentBookingForm";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const PATIENT_WITH_BOTH: PatientSummary = {
  id: "patient-1",
  tenantId: "tenant-1",
  mrn: "MRN-0001",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-12",
  gender: "female",
  phone: "+15551234567",
  email: "jane@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const PATIENT_EMAIL_ONLY: PatientSummary = {
  ...PATIENT_WITH_BOTH,
  id: "patient-2",
  phone: null,
};

const PATIENT_NO_CONTACT: PatientSummary = {
  ...PATIENT_WITH_BOTH,
  id: "patient-3",
  phone: null,
  email: null,
};

async function selectPatient(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/patient name/i), "Jane");
  await user.click(screen.getByRole("button", { name: /search/i }));
  await user.click(await screen.findByRole("button", { name: /select/i }));
}

describe("AppointmentBookingForm (AC1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires selecting a patient before showing the booking fields", () => {
    renderWithClient(
      <AppointmentBookingForm
        fixedProviderId="provider-1"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.queryByLabelText(/start time/i)).not.toBeInTheDocument();
  });

  it("shows a Provider ID field when no fixedProviderId is given (clinic_admin/staff, AC1 cross-provider)", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT_WITH_BOTH],
      page: 1,
      limit: 20,
      total: 1,
    });

    renderWithClient(
      <AppointmentBookingForm onSubmit={vi.fn()} isSubmitting={false} />,
    );
    await selectPatient(user);

    expect(screen.getByLabelText(/provider id/i)).toBeInTheDocument();
  });

  it("hides the Provider ID field when fixedProviderId is given (provider role)", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT_WITH_BOTH],
      page: 1,
      limit: 20,
      total: 1,
    });

    renderWithClient(
      <AppointmentBookingForm
        fixedProviderId="provider-1"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    await selectPatient(user);

    expect(screen.queryByLabelText(/provider id/i)).not.toBeInTheDocument();
  });

  it("lets the caller choose sms or email when the patient has both on file", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT_WITH_BOTH],
      page: 1,
      limit: 20,
      total: 1,
    });

    renderWithClient(
      <AppointmentBookingForm
        fixedProviderId="provider-1"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    await selectPatient(user);

    expect(screen.getByLabelText(/sms/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it("submits a well-formed CreateAppointmentRequest", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT_WITH_BOTH],
      page: 1,
      limit: 20,
      total: 1,
    });
    const onSubmit = vi.fn();

    renderWithClient(
      <AppointmentBookingForm
        fixedProviderId="provider-1"
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );
    await selectPatient(user);

    await user.type(screen.getByLabelText(/^date$/i), "2026-07-20");
    await user.type(screen.getByLabelText(/start time/i), "14:00");
    await user.type(screen.getByLabelText(/end time/i), "14:30");
    await user.click(screen.getByRole("button", { name: /book appointment/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      providerId: "provider-1",
      patientId: "patient-1",
      startTime: "2026-07-20T14:00:00.000Z",
      endTime: "2026-07-20T14:30:00.000Z",
      notifyChannel: "sms",
      notifyTo: "+15551234567",
    });
  });

  it("defaults to email when only an email is on file", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT_EMAIL_ONLY],
      page: 1,
      limit: 20,
      total: 1,
    });
    const onSubmit = vi.fn();

    renderWithClient(
      <AppointmentBookingForm
        fixedProviderId="provider-1"
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );
    await selectPatient(user);
    await user.type(screen.getByLabelText(/^date$/i), "2026-07-20");
    await user.type(screen.getByLabelText(/start time/i), "14:00");
    await user.type(screen.getByLabelText(/end time/i), "14:30");
    await user.click(screen.getByRole("button", { name: /book appointment/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        notifyChannel: "email",
        notifyTo: "jane@example.com",
      }),
    );
  });

  it("blocks booking and explains why when the patient has no phone or email on file", async () => {
    const user = userEvent.setup();
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue({
      items: [PATIENT_NO_CONTACT],
      page: 1,
      limit: 20,
      total: 1,
    });

    renderWithClient(
      <AppointmentBookingForm
        fixedProviderId="provider-1"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    await selectPatient(user);

    expect(screen.getByText(/no phone or email on file/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /book appointment/i }),
    ).toBeDisabled();
  });
});
