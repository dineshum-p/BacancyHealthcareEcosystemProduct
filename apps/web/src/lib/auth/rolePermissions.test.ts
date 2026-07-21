import { describe, expect, it } from "vitest";
import { roleHasPermission } from "./rolePermissions";

describe("roleHasPermission (BAC-17, AC4)", () => {
  it("grants read_patient to every role", () => {
    expect(roleHasPermission("super_admin", "read_patient")).toBe(true);
    expect(roleHasPermission("clinic_admin", "read_patient")).toBe(true);
    expect(roleHasPermission("provider", "read_patient")).toBe(true);
    expect(roleHasPermission("staff", "read_patient")).toBe(true);
  });

  it("grants write_patient to super_admin, clinic_admin, and provider only", () => {
    expect(roleHasPermission("super_admin", "write_patient")).toBe(true);
    expect(roleHasPermission("clinic_admin", "write_patient")).toBe(true);
    expect(roleHasPermission("provider", "write_patient")).toBe(true);
    expect(roleHasPermission("staff", "write_patient")).toBe(false);
  });

  it("grants review_patient_self_registration to super_admin, clinic_admin, and staff only (BAC-37)", () => {
    expect(
      roleHasPermission("super_admin", "review_patient_self_registration"),
    ).toBe(true);
    expect(
      roleHasPermission("clinic_admin", "review_patient_self_registration"),
    ).toBe(true);
    expect(
      roleHasPermission("staff", "review_patient_self_registration"),
    ).toBe(true);
    expect(
      roleHasPermission("provider", "review_patient_self_registration"),
    ).toBe(false);
  });
});

describe("roleHasPermission (BAC-21)", () => {
  it("grants read_appointments and manage_appointments to every role", () => {
    for (const role of [
      "super_admin",
      "clinic_admin",
      "provider",
      "staff",
    ] as const) {
      expect(roleHasPermission(role, "read_appointments")).toBe(true);
      expect(roleHasPermission(role, "manage_appointments")).toBe(true);
    }
  });
});

describe("roleHasPermission (BAC-20)", () => {
  it("grants read_encounter to super_admin, clinic_admin, and provider for oversight, but NOT staff", () => {
    expect(roleHasPermission("super_admin", "read_encounter")).toBe(true);
    expect(roleHasPermission("clinic_admin", "read_encounter")).toBe(true);
    expect(roleHasPermission("provider", "read_encounter")).toBe(true);
    expect(roleHasPermission("staff", "read_encounter")).toBe(false);
  });

  it("grants write_encounter to provider only -- the encounter's treating provider (RBAC)", () => {
    expect(roleHasPermission("provider", "write_encounter")).toBe(true);
    expect(roleHasPermission("super_admin", "write_encounter")).toBe(false);
    expect(roleHasPermission("clinic_admin", "write_encounter")).toBe(false);
    expect(roleHasPermission("staff", "write_encounter")).toBe(false);
  });
});
