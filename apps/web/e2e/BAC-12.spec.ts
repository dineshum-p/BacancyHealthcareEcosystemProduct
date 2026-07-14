import { test, expect, type Page } from "@playwright/test";

/**
 * BAC-12: Onboard a tenant end-to-end from the Super Admin console.
 *
 * These specs drive the real running app (apps/web) against the real
 * services/tenant, services/auth, and services/notification backends.
 * No login UI exists yet, so sessions are seeded directly via a
 * pre-signed JWT fixture written into localStorage, mirroring the token
 * fixture a backend e2e spec would use.
 */

const SUPER_ADMIN_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZjY5ZjE0YS1lZDNkLTQyOGQtYjZkNy1kODM1NzBiYmVkYzEiLCJ0ZW5hbnRJZCI6IjliZDdmYTM2LTI3MzUtNDMwOC05YTM0LTI4ZTc3MTNiMDgzYyIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImlhdCI6MTc4NDAwODQ2NiwiZXhwIjoxNzg0MDEyMDY2fQ.J8AUsHAfzvrVz7SQuUm9zw8KWzQYjQ0qCu7WqPnJQ4Y";

const STAFF_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhYTg5NTNhNS0wOTBmLTQyOWMtODRjNi1mYmNmMmUzMTZmZjEiLCJ0ZW5hbnRJZCI6IjliZDdmYTM2LTI3MzUtNDMwOC05YTM0LTI4ZTc3MTNiMDgzYyIsInJvbGUiOiJzdGFmZiIsImlhdCI6MTc4NDAwODQ2NiwiZXhwIjoxNzg0MDEyMDY2fQ.eeBVz3l5k53KiyOP8S9r66F1hivTiYkyng6iRTwg3hA";

async function seedSession(page: Page, token: string) {
  await page.addInitScript(
    (t) => window.localStorage.setItem("hep.accessToken", t),
    token,
  );
}

function uniqueSlug() {
  return `qa-clinic-${Date.now()}`;
}

test.describe("BAC-12 Super Admin tenant onboarding console", () => {
  test("AC1/AC2: super_admin can onboard a tenant and see it active with provisioning results", async ({
    page,
  }) => {
    await seedSession(page, SUPER_ADMIN_TOKEN);
    await page.goto("/admin/tenants/onboard");

    const slug = uniqueSlug();

    await page.getByRole("textbox", { name: "Clinic name" }).fill("QA Automation Clinic");
    await page.getByRole("textbox", { name: "Slug" }).fill(slug);
    await page.getByRole("textbox", { name: "Plan" }).fill("starter");
    await page
      .getByRole("textbox", { name: "Admin email" })
      .fill(`admin@${slug}.example.com`);

    await page.getByRole("button", { name: "Onboard tenant" }).click();

    await expect(page.getByText("Tenant status: active")).toBeVisible();
    await expect(page.getByText("Admin seed: succeeded")).toBeVisible();
    await expect(page.getByText("Invite: succeeded")).toBeVisible();

    // AC3: the tenant list reflects the same tenant with status + provisioning result.
    await page.goto("/admin/tenants");

    const row = page.getByRole("row", { name: new RegExp(slug) });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "active" })).toBeVisible();
    await expect(row.getByText("Admin seed: succeeded")).toBeVisible();
    await expect(row.getByText("Invite: succeeded")).toBeVisible();
  });

  test("AC3: tenant list page shows status and provisioning result per tenant", async ({
    page,
  }) => {
    await seedSession(page, SUPER_ADMIN_TOKEN);
    await page.goto("/admin/tenants");

    await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Provisioning result" }),
    ).toBeVisible();

    const seedRow = page.getByRole("row", { name: /Acme Clinic/ });
    await expect(seedRow).toBeVisible();
    await expect(seedRow.getByRole("cell", { name: "active" })).toBeVisible();
  });

  test("AC4: a non-super_admin (staff) is denied access to the onboarding console", async ({
    page,
  }) => {
    await seedSession(page, STAFF_TOKEN);

    await page.goto("/admin/tenants");
    await expect(page.getByText("403")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You are not authorized to view this page" }),
    ).toBeVisible();

    await page.goto("/admin/tenants/onboard");
    await expect(page.getByText("403")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You are not authorized to view this page" }),
    ).toBeVisible();
  });
});
