import { describe, expect, it, beforeEach } from "vitest";
import type { AuthTokens } from "@hep/shared-types";
import {
  getStoredAccessToken,
  getStoredRefreshToken,
} from "@/src/lib/auth/session";
import { completeLogin } from "./completeLogin";

function fakeJwt(payload: object): string {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.sig`;
}

describe("completeLogin", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists both tokens (AC1)", () => {
    const tokens: AuthTokens = {
      accessToken: fakeJwt({
        userId: "u1",
        tenantId: "t1",
        role: "clinic_admin",
      }),
      refreshToken: "refresh-token",
      expiresIn: 900,
    };

    completeLogin(tokens);

    expect(getStoredAccessToken()).toBe(tokens.accessToken);
    expect(getStoredRefreshToken()).toBe(tokens.refreshToken);
  });

  it("resolves the super_admin dashboard path from the access token's role (AC4)", () => {
    const tokens: AuthTokens = {
      accessToken: fakeJwt({
        userId: "u1",
        tenantId: "t1",
        role: "super_admin",
      }),
      refreshToken: "refresh-token",
      expiresIn: 900,
    };

    expect(completeLogin(tokens)).toBe("/admin/tenants");
  });

  it("resolves the placeholder home path for every other role (AC4)", () => {
    const tokens: AuthTokens = {
      accessToken: fakeJwt({ userId: "u1", tenantId: "t1", role: "staff" }),
      refreshToken: "refresh-token",
      expiresIn: 900,
    };

    expect(completeLogin(tokens)).toBe("/");
  });
});
