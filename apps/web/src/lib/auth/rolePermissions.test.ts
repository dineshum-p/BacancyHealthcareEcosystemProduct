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
