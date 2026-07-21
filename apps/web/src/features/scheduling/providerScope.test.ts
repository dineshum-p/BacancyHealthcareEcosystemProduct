import { describe, expect, it } from "vitest";
import { canManageAnyProvidersSchedule, resolveOwnProviderId } from "./providerScope";

describe("canManageAnyProvidersSchedule (BAC-21 RBAC)", () => {
  it("is true for clinic_admin, staff, and super_admin", () => {
    expect(canManageAnyProvidersSchedule("clinic_admin")).toBe(true);
    expect(canManageAnyProvidersSchedule("staff")).toBe(true);
    expect(canManageAnyProvidersSchedule("super_admin")).toBe(true);
  });

  it("is false for provider", () => {
    expect(canManageAnyProvidersSchedule("provider")).toBe(false);
  });
});

describe("resolveOwnProviderId (BAC-21 RBAC)", () => {
  it("returns the caller's own userId for a provider (no picker needed)", () => {
    expect(resolveOwnProviderId({ userId: "u1", tenantId: "t1", role: "provider" })).toBe(
      "u1",
    );
  });
});
