/**
 * ODQA-031 — Cross-Browser Compatibility Smoke Test
 *
 * Verifies that the app loads and basic UI elements are present in all configured browsers/devices.
 * This test is intended to be run with all Playwright projects (Chrome, Firefox, Safari, Edge, Mobile Chrome, Mobile Safari).
 */
import { test, expect } from "@playwright/test";

// This test will run in every configured browser/device project

test.describe("ODQA-031 — Cross-Browser Compatibility", () => {
  test("App loads and displays main UI elements", async ({ page, browserName }) => {
    await page.goto("/");

    // Confirm the browser/device context for debug
    // (This will show up in Playwright's test output)
    console.log("Running in browser:", browserName);

    // Check main heading
    const heading = page.getByRole("heading", { name: /OpenDesign QA/i });
    await expect(heading).toBeVisible();

    // Check navigation
    const nav = page.locator("header");
    await expect(nav).toBeVisible();

    // Check CTA link
    const cta = page.getByRole("link", { name: /Start New Audit/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/runs/new");
  });
});
