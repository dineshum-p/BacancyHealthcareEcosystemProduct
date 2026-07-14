import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type { AuthTokens, LoginResult, MfaChallenge } from "@hep/shared-types";
import { login, verifyMfaLogin } from "./authApi";

describe("authApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("login", () => {
    it("POSTs /auth/login with the tenant header and credentials (AC1)", async () => {
      const tokens: AuthTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 900,
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(tokens), { status: 200 }),
      );

      const result: LoginResult = await login("acme", {
        email: "admin@acme.example.com",
        password: "s3cret!!",
      });

      expect(result).toEqual(tokens);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/auth\/login$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({
        email: "admin@acme.example.com",
        password: "s3cret!!",
      });
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Tenant-Id")).toBe("acme");
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("resolves an mfa_required challenge instead of tokens (AC2)", async () => {
      const challenge: MfaChallenge = {
        mfaRequired: true,
        mfaChallengeToken: "challenge-token",
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(challenge), { status: 200 }),
      );

      const result = await login("acme", {
        email: "admin@acme.example.com",
        password: "s3cret!!",
      });

      expect(result).toEqual(challenge);
    });

    it("throws a descriptive error for invalid credentials (AC3)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid email or password." }), {
          status: 401,
        }),
      );

      await expect(
        login("acme", { email: "nobody@acme.example.com", password: "wrong" }),
      ).rejects.toThrow("Invalid email or password.");
    });
  });

  describe("verifyMfaLogin", () => {
    it("POSTs /auth/mfa/login-verify with the tenant header and challenge (AC2)", async () => {
      const tokens: AuthTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 900,
      };
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(tokens), { status: 200 }),
      );

      const result = await verifyMfaLogin("acme", {
        mfaChallengeToken: "challenge-token",
        totpCode: "123456",
      });

      expect(result).toEqual(tokens);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/auth\/mfa\/login-verify$/);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({
        mfaChallengeToken: "challenge-token",
        totpCode: "123456",
      });
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Tenant-Id")).toBe("acme");
    });

    it("throws a descriptive error for an invalid TOTP code (AC3)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Invalid or expired authentication code." }),
          { status: 401 },
        ),
      );

      await expect(
        verifyMfaLogin("acme", {
          mfaChallengeToken: "challenge-token",
          totpCode: "000000",
        }),
      ).rejects.toThrow("Invalid or expired authentication code.");
    });
  });
});
