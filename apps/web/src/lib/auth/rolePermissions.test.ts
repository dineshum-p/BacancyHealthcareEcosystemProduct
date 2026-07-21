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

describe("roleHasPermission (BAC-46)", () => {
  it("grants read_patient_profile and write_patient_profile to patient only -- the 'My Profile' page is self-scoped", () => {
    expect(roleHasPermission("patient", "read_patient_profile")).toBe(true);
    expect(roleHasPermission("patient", "write_patient_profile")).toBe(true);
    expect(roleHasPermission("staff", "read_patient_profile")).toBe(false);
    expect(roleHasPermission("provider", "read_patient_profile")).toBe(false);
  });
});

describe("roleHasPermission (BAC-47)", () => {
  it("grants create_visit_intake to patient only -- submitting a visit intake is self-scoped", () => {
    expect(roleHasPermission("patient", "create_visit_intake")).toBe(true);
    expect(roleHasPermission("staff", "create_visit_intake")).toBe(false);
    expect(roleHasPermission("provider", "create_visit_intake")).toBe(false);
  });

  it("grants read_visit_intake_queue and link_visit_intake to staff-side roles only, never patient/provider", () => {
    for (const role of ["super_admin", "clinic_admin", "staff"] as const) {
      expect(roleHasPermission(role, "read_visit_intake_queue")).toBe(true);
      expect(roleHasPermission(role, "link_visit_intake")).toBe(true);
    }
    expect(roleHasPermission("provider", "read_visit_intake_queue")).toBe(
      false,
    );
    expect(roleHasPermission("patient", "read_visit_intake_queue")).toBe(
      false,
    );
    expect(roleHasPermission("provider", "link_visit_intake")).toBe(false);
    expect(roleHasPermission("patient", "link_visit_intake")).toBe(false);
  });

  it("grants read_visit_intake to every role that can ever read a single intake (patient's own, provider's assigned, and every staff-side role)", () => {
    for (const role of [
      "super_admin",
      "clinic_admin",
      "staff",
      "provider",
      "patient",
    ] as const) {
      expect(roleHasPermission(role, "read_visit_intake")).toBe(true);
    }
  });
});
