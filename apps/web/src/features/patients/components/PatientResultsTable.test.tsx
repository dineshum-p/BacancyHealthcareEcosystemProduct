import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PatientSummary } from "@hep/shared-types";
import { PatientResultsTable } from "./PatientResultsTable";

const PATIENTS: PatientSummary[] = [
  {
    id: "p1",
    tenantId: "tenant-1",
    mrn: "MRN-0001",
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "1990-05-12",
    gender: "female",
    phone: "555-0100",
    email: "jane.doe@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("PatientResultsTable", () => {
  it("renders each patient's demographics and MRN (AC2)", () => {
    render(<PatientResultsTable patients={PATIENTS} />);

    expect(screen.getByText("Doe, Jane")).toBeInTheDocument();
    expect(screen.getByText("MRN-0001")).toBeInTheDocument();
    expect(screen.getByText("1990-05-12")).toBeInTheDocument();
    expect(screen.getByText("jane.doe@example.com")).toBeInTheDocument();
  });

  it("omits the chart link by default (BAC-20, RBAC)", () => {
    render(<PatientResultsTable patients={PATIENTS} />);

    expect(
      screen.queryByRole("link", { name: /view chart/i }),
    ).not.toBeInTheDocument();
  });

  it("links each patient row to its encounters page when canViewEncounters (BAC-20, AC1)", () => {
    render(
      <PatientResultsTable patients={PATIENTS} canViewEncounters />,
    );

    expect(screen.getByRole("link", { name: /view chart/i })).toHaveAttribute(
      "href",
      "/patients/p1/encounters",
    );
  });
});
