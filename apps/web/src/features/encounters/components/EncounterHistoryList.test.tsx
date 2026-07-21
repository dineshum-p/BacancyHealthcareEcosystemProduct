import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EncounterSummary } from "@hep/shared-types";
import { EncounterHistoryList } from "./EncounterHistoryList";

const ENCOUNTER: EncounterSummary = {
  id: "e1",
  tenantId: "tenant-1",
  patientId: "p1",
  soapNote: {
    subjective: "Patient reports headache.",
    objective: "Alert and oriented.",
    assessment: "Tension headache.",
    plan: "OTC analgesic, follow up in a week.",
  },
  vitals: { heartRate: 72, spO2: 98 },
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("EncounterHistoryList (BAC-20, AC1/AC2)", () => {
  it("shows a loading state", () => {
    render(<EncounterHistoryList encounters={undefined} isLoading isError={false} />);
    expect(screen.getByText(/loading encounter history/i)).toBeInTheDocument();
  });

  it("shows an error state", () => {
    render(<EncounterHistoryList encounters={undefined} isLoading={false} isError />);
    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
  });

  it("shows an empty state when there is no history yet", () => {
    render(<EncounterHistoryList encounters={[]} isLoading={false} isError={false} />);
    expect(screen.getByText(/no encounter notes yet/i)).toBeInTheDocument();
  });

  it("renders each signed note's SOAP sections, vitals, and allergies (AC1)", () => {
    render(
      <EncounterHistoryList
        encounters={[ENCOUNTER]}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("Patient reports headache.")).toBeInTheDocument();
    expect(screen.getByText("Alert and oriented.")).toBeInTheDocument();
    expect(screen.getByText("Tension headache.")).toBeInTheDocument();
    expect(
      screen.getByText("OTC analgesic, follow up in a week."),
    ).toBeInTheDocument();
    expect(screen.getByText(/72 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/98%/)).toBeInTheDocument();
    expect(screen.getByText("Penicillin")).toBeInTheDocument();
    expect(screen.getByText("severe")).toBeInTheDocument();
  });

  it("renders no edit controls -- a signed note is immutable in the UI (RBAC)", () => {
    render(
      <EncounterHistoryList
        encounters={[ENCOUNTER]}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
});
