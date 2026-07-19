import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForbiddenView } from "./ForbiddenView";

describe("ForbiddenView", () => {
  it("renders the default Super Admin console message when no description is given", () => {
    render(<ForbiddenView />);

    expect(
      screen.getByText(/not authorized to view this page/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/restricted to Super Admins/i)).toBeInTheDocument();
  });

  it("renders a custom description when one is given (BAC-17, AC4)", () => {
    render(
      <ForbiddenView description="You need patient-write access to register a patient." />,
    );

    expect(
      screen.getByText(/patient-write access to register a patient/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/restricted to Super Admins/i),
    ).not.toBeInTheDocument();
  });
});
