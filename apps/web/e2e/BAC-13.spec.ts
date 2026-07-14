import { test, expect, type Page } from "@playwright/test";

/**
 * BAC-13: Provide a login screen with MFA challenge flow.
 *
 * These specs drive the real running app (apps/web) against the real
 * services/auth backend (CORS-enabled). No token fixture is used here --
 * this ticket's own login UI is the thing under test, so every scenario
 * goes through the real /auth/login form.
 *
 * Test accounts (seeded in the live auth backend for tenant acme-clinic):
 * - Account A: owner@acme-clinic.example.com / Sup3rSecret!234 (super_admin, no MFA)
 * - Account B: staff-mfa@acme-clinic.example.com / Sup3rSecret!234 (staff, MFA active)
 *
 * Note: Account B's real TOTP secret is only known to the harness that
 * provisioned it, so this spec exercises the MFA challenge step rendering
 * and the invalid-code error path, but does not complete a successful
 * MFA login (no way to generate a valid rotating code here).
 */

async function clearSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

test.describe("BAC-13 Login screen with MFA challenge flow", () => {
  test("AC3: invalid credentials show an inline error and keep the user on the page", async ({
    page,
  }) => {
    await clearSession(page);
    await page.goto("/login");

    await page.getByRole("textbox", { name: "Workspace" }).fill("acme-clinic");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("owner@acme-clinic.example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("WrongPassword123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("AC2/AC3: MFA-active account is challenged for a TOTP code, and an invalid code errors inline without leaving the challenge step", async ({
    page,
  }) => {
    await clearSession(page);
    await page.goto("/login");

    await page.getByRole("textbox", { name: "Workspace" }).fill("acme-clinic");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("staff-mfa@acme-clinic.example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("Sup3rSecret!234");
    await page.getByRole("button", { name: "Sign in" }).click();

    // AC2: TOTP entry step renders with clear labeling.
    const codeField = page.getByRole("textbox", { name: "Authentication code" });
    await expect(codeField).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify" })).toBeVisible();

    // AC3: an obviously-wrong code errors inline and keeps the user on the challenge step.
    await codeField.fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(
      page.getByText(/invalid or expired authentication code/i),
    ).toBeVisible();
    await expect(codeField).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("AC1/AC4: no-MFA account logs in, lands on the role-appropriate dashboard, session persists on reload, and authenticated /login redirects away", async ({
    page,
  }) => {
    await clearSession(page);
    await page.goto("/login");

    await page.getByRole("textbox", { name: "Workspace" }).fill("acme-clinic");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("owner@acme-clinic.example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("Sup3rSecret!234");
    await page.getByRole("button", { name: "Sign in" }).click();

    // AC1: no TOTP step for a no-MFA account; lands on the super_admin dashboard.
    await expect(page).toHaveURL(/\/admin\/tenants$/);
    await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();

    // Session persists across a reload.
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/tenants$/);
    await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();

    // AC4: an authenticated user hitting /login is redirected to their dashboard.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/admin\/tenants$/);
    await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();
  });
});
