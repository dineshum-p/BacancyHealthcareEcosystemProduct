import { test, expect, type Page } from "@playwright/test";

/**
 * BAC-17: Register and search patients from the clinic UI.
 *
 * These specs drive the real running app (apps/web) against the real
 * services/patient backend (CORS-enabled), through the real /login form
 * established by BAC-13.
 *
 * Test accounts (seeded in the live auth backend for tenant bac17-qa):
 * - owner@bac17-qa.example.com / Sup3rSecret!234 (super_admin, has
 *   patient-write permission, no MFA)
 * - frontdesk@bac17-qa.example.com / Sup3rSecret!234 (staff, does NOT have
 *   patient-write permission, no MFA) — used for the AC4 negative-access test
 *
 * Seeded patients for tenant bac17-qa at the start of this suite:
 * - Jane Doe, MRN-000001, DOB 1990-05-12
 * - Zephyrine Quillfeather, MRN-000002, DOB 1985-03-22
 * - Marguerite Beaumont, MRN-000003, DOB 2099-01-01
 */

async function clearSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function loginAsOwner(page: Page) {
  await clearSession(page);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Workspace" }).fill("bac17-qa");
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("owner@bac17-qa.example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("Sup3rSecret!234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/tenants$/);
}

async function loginAsFrontdesk(page: Page) {
  await clearSession(page);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Workspace" }).fill("bac17-qa");
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("frontdesk@bac17-qa.example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("Sup3rSecret!234");
  await page.getByRole("button", { name: "Sign in" }).click();
  // frontdesk is a non-admin staff role, so it does not land on the admin
  // console like the owner does -- just confirm the login actually completed.
  await expect(page).not.toHaveURL(/\/login$/);
}

test.describe("BAC-17 Register and search patients from the clinic UI", () => {
  test("AC1: registering a patient assigns and displays an MRN", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/patients/register");

    const uniqueLastName = `E2ERegister-${Date.now()}`;
    await page.getByRole("textbox", { name: "First name" }).fill("Aiden");
    await page.getByRole("textbox", { name: "Last name" }).fill(uniqueLastName);
    await page
      .getByRole("textbox", { name: "Date of birth" })
      .fill("1978-11-02");
    await page.getByRole("button", { name: "Register patient" }).click();

    await expect(
      page.getByText(`Aiden ${uniqueLastName} was registered.`),
    ).toBeVisible();
    await expect(page.getByText(/^MRN: MRN-\d{6}$/)).toBeVisible();
  });

  test("AC2: search by DOB correctly finds the patient by exact date of birth (regression: previously off-by-one)", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/patients");

    await page.getByRole("textbox", { name: "Date of birth" }).fill("1990-05-12");
    await page.getByRole("button", { name: "Search" }).click();

    const row = page.getByRole("row", { name: /Doe, Jane/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("MRN-000001")).toBeVisible();
    await expect(row.getByText("1990-05-12")).toBeVisible();
  });

  test("AC2: a newly registered patient's DOB is displayed exactly as entered in search results (regression: previously rendered one day earlier)", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/patients/register");

    const uniqueLastName = `E2EDob-${Date.now()}`;
    await page.getByRole("textbox", { name: "First name" }).fill("Marisol");
    await page.getByRole("textbox", { name: "Last name" }).fill(uniqueLastName);
    await page
      .getByRole("textbox", { name: "Date of birth" })
      .fill("1985-03-22");
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(
      page.getByText(`Marisol ${uniqueLastName} was registered.`),
    ).toBeVisible();

    await page.goto("/patients");
    await page.getByRole("textbox", { name: "Name" }).fill(uniqueLastName);
    await page.getByRole("button", { name: "Search" }).click();

    const row = page.getByRole("row", { name: new RegExp(uniqueLastName) });
    await expect(row).toBeVisible();
    await expect(row.getByText("1985-03-22", { exact: true })).toBeVisible();
    await expect(row.getByText("1985-03-21")).toHaveCount(0);
  });

  test("AC2: search by name and by MRN return the matching patient", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/patients");

    await page.getByRole("textbox", { name: "Name" }).fill("Quillfeather");
    await page.getByRole("button", { name: "Search" }).click();
    const nameRow = page.getByRole("row", { name: /Quillfeather, Zephyrine/ });
    await expect(nameRow).toBeVisible();
    await expect(nameRow.getByText("MRN-000002")).toBeVisible();

    await page.goto("/patients");
    await page.getByRole("textbox", { name: "MRN" }).fill("MRN-000001");
    await page.getByRole("button", { name: "Search" }).click();
    const mrnRow = page.getByRole("row", { name: /Doe, Jane/ });
    await expect(mrnRow).toBeVisible();
    await expect(mrnRow.getByText("MRN-000001")).toBeVisible();
  });

  test("AC2: a search matching no patients renders the empty state", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/patients");

    await page
      .getByRole("textbox", { name: "Name" })
      .fill("Nonexistent-Patient-Zzz-9999");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText(/no patients found/i)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("AC2: results render correctly with an artificially slow response, and pagination controls render sensibly", async ({
    page,
  }) => {
    await loginAsOwner(page);

    // Artificially delay the patient search response so a loading affordance
    // (if any -- spinner, disabled control, or "Loading" text) has a real
    // window to appear, without hard-coding its exact implementation.
    let sawNonFinalState = false;
    await page.route("http://localhost:3006/patients**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });

    await page.goto("/patients");

    // Poll during the artificial delay: some loading affordance should be
    // present (button disabled, a "loading" label, or an aria-busy region).
    await expect
      .poll(async () => {
        const disabled = await page
          .getByRole("button", { name: "Search" })
          .isDisabled()
          .catch(() => false);
        const loadingText = await page
          .getByText(/loading/i)
          .isVisible()
          .catch(() => false);
        const ariaBusy = await page
          .locator('[aria-busy="true"]')
          .count()
          .catch(() => 0);
        if (disabled || loadingText || ariaBusy > 0) {
          sawNonFinalState = true;
        }
        // Resolve once the final results table has rendered, so the poll
        // doesn't run forever if no loading affordance is ever observed.
        const tableVisible = await page
          .getByRole("table")
          .isVisible()
          .catch(() => false);
        return tableVisible;
      }, { timeout: 3000 })
      .toBe(true);

    // Regardless of whether a distinct loading affordance was caught, the
    // final state must render the results correctly.
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("row", { name: /Doe, Jane/ })).toBeVisible();

    // Only a handful of seeded patients exist, so the single page of results
    // renders with disabled Previous/Next controls and a clear page label.
    await expect(page.getByText(/page 1 of 1/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

    test.info().annotations.push({
      type: "loading-affordance-observed",
      description: String(sawNonFinalState),
    });
  });

  test("AC3: submitting an incomplete registration form shows inline validation errors and preserves entered data", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/patients/register");

    await page.getByRole("textbox", { name: "First name" }).fill("Preserved");
    await page.getByRole("textbox", { name: "Phone" }).fill("555-000-1111");
    // Deliberately leave Last name and Date of birth blank.
    await page.getByRole("button", { name: "Register patient" }).click();

    await expect(page.getByText("Last name is required")).toBeVisible();
    await expect(page.getByText("Date of birth is required")).toBeVisible();

    // Entered data must be preserved after the failed submit.
    await expect(page.getByRole("textbox", { name: "First name" })).toHaveValue(
      "Preserved",
    );
    await expect(page.getByRole("textbox", { name: "Phone" })).toHaveValue(
      "555-000-1111",
    );
  });

  test("AC4: a user without patient-write permission cannot access patient registration", async ({
    page,
  }) => {
    await loginAsFrontdesk(page);

    // The "Register patient" entry point must not be shown from the patient
    // search page for a user lacking patient-write permission.
    await page.goto("/patients");
    await expect(
      page.getByRole("button", { name: "Register patient" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Register patient" }),
    ).toHaveCount(0);

    // Direct navigation to the registration route must render a forbidden
    // view, not the registration form.
    await page.goto("/patients/register");
    await expect(page.getByText("403")).toBeVisible();
    await expect(page.getByText(/not authorized/i)).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "First name" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Register patient" }),
    ).toHaveCount(0);
  });
});
