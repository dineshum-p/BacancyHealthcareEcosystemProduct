import { describe, expect, it } from "vitest";
import { resolveDashboardPath } from "./dashboardPath";

describe("resolveDashboardPath", () => {
  it("sends a super_admin to the Super Admin tenant console (AC4)", () => {
    expect(resolveDashboardPath("super_admin")).toBe("/admin/tenants");
  });

  it.each(["clinic_admin", "provider", "staff"] as const)(
    "sends a %s to the patient search page (BAC-17's landing feature; every role has read_patient)",
    (role) => {
      expect(resolveDashboardPath(role)).toBe("/patients");
    },
  );
});
