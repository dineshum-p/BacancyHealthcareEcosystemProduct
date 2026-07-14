import { describe, expect, it, beforeEach } from "vitest";
import type { AccessTokenPayload } from "@hep/shared-types";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  clearStoredAccessToken,
  decodeAccessToken,
  getCurrentUser,
  getStoredAccessToken,
  setStoredAccessToken,
} from "./session";

function fakeJwt(payload: AccessTokenPayload): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(payload);
  return `${header}.${body}.fake-signature`;
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("session", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("decodeAccessToken", () => {
    it("decodes the claims from a well-formed JWT", () => {
      const token = fakeJwt({
        userId: "user-1",
        tenantId: "tenant-1",
        role: "super_admin",
      });

      expect(decodeAccessToken(token)).toEqual({
        userId: "user-1",
        tenantId: "tenant-1",
        role: "super_admin",
      });
    });

    it("returns null for a malformed token", () => {
      expect(decodeAccessToken("not-a-jwt")).toBeNull();
    });

    it("returns null for a token whose payload segment isn't valid JSON", () => {
      const token = `header.${Buffer.from("not-json").toString("base64url")}.sig`;
      expect(decodeAccessToken(token)).toBeNull();
    });
  });

  describe("stored access token", () => {
    it("returns null when nothing is stored", () => {
      expect(getStoredAccessToken()).toBeNull();
    });

    it("round-trips a token through set/get/clear", () => {
      setStoredAccessToken("abc.def.ghi");
      expect(getStoredAccessToken()).toBe("abc.def.ghi");
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe(
        "abc.def.ghi",
      );

      clearStoredAccessToken();
      expect(getStoredAccessToken()).toBeNull();
    });
  });

  describe("getCurrentUser", () => {
    it("returns null when no token is stored", () => {
      expect(getCurrentUser()).toBeNull();
    });

    it("returns the decoded claims for the stored token", () => {
      setStoredAccessToken(
        fakeJwt({ userId: "user-1", tenantId: "tenant-1", role: "clinic_admin" }),
      );

      expect(getCurrentUser()).toEqual({
        userId: "user-1",
        tenantId: "tenant-1",
        role: "clinic_admin",
      });
    });
  });
});
