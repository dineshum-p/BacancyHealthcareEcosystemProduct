import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import { RequirePermission } from "./RequirePermission";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

describe("RequirePermission", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the protected content once the caller's role holds the permission (BAC-17, AC1)", async () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "provider" }),
    );

    render(
      <RequirePermission permission="write_patient">
        <div>protected content</div>
      </RequirePermission>,
    );

    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });

  it("renders a 403 forbidden view for a signed-in user whose role lacks the permission (BAC-17, AC4)", async () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );

    render(
      <RequirePermission permission="write_patient">
        <div>protected content</div>
      </RequirePermission>,
    );

    expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders a custom denied description when one is given", async () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );

    render(
      <RequirePermission
        permission="write_patient"
        deniedDescription="You need patient-write access to register a patient."
      >
        <div>protected content</div>
      </RequirePermission>,
    );

    expect(
      await screen.findByText(/patient-write access to register a patient/i),
    ).toBeInTheDocument();
  });

  it("renders a 403 forbidden view when there is no signed-in user at all", async () => {
    render(
      <RequirePermission permission="write_patient">
        <div>protected content</div>
      </RequirePermission>,
    );

    expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  });
});
