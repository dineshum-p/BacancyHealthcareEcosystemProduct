import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { setStoredAccessToken } from "./session";
import { useCurrentUser } from "./useCurrentUser";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

function Probe() {
  const { user, isLoading } = useCurrentUser();
  if (isLoading) return <div>loading</div>;
  return <div>{user ? `role:${user.role}` : "anonymous"}</div>;
}

describe("useCurrentUser", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("resolves to anonymous when no token is stored", async () => {
    render(<Probe />);
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
  });

  it("resolves to the decoded user when a token is stored", async () => {
    setStoredAccessToken(
      fakeJwt({ userId: "u1", tenantId: "t1", role: "super_admin" }),
    );

    render(<Probe />);
    expect(await screen.findByText("role:super_admin")).toBeInTheDocument();
  });

  it("resolves to anonymous when the stored token is expired (BAC-13 regression)", async () => {
    setStoredAccessToken(
      fakeJwt({
        userId: "u1",
        tenantId: "t1",
        role: "super_admin",
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
    );

    render(<Probe />);
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
  });
});
