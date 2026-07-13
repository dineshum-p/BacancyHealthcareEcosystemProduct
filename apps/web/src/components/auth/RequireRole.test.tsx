import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { setStoredAccessToken } from "@/src/lib/auth/session";
import { RequireRole } from "./RequireRole";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

describe("RequireRole", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the protected content once the user has an allowed role (AC1/AC3)", async () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "super_admin" }),
    );

    render(
      <RequireRole allow={["super_admin"]}>
        <div>protected content</div>
      </RequireRole>,
    );

    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });

  it("renders a 403 forbidden view for a signed-in user without an allowed role (AC4)", async () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
    );

    render(
      <RequireRole allow={["super_admin"]}>
        <div>protected content</div>
      </RequireRole>,
    );

    expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders a 403 forbidden view when there is no signed-in user at all (AC4)", async () => {
    render(
      <RequireRole allow={["super_admin"]}>
        <div>protected content</div>
      </RequireRole>,
    );

    expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  });
});
