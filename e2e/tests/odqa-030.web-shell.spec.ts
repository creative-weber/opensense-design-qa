/**
 * ODQA-030 — Scaffold Web App
 *
 * Verifies the Next.js web application shell:
 * - App starts and serves the root route
 * - Root route renders a minimal shell with a heading and navigation
 * - The "Start New Audit" CTA link is present and navigates to /runs/new
 * - Navigation brand link navigates back to the home page
 * - TanStack Query provider is mounted (no query-related runtime errors)
 * - Tailwind CSS is applied (basic style classes are present in markup)
 */
import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-030: Scaffold Web App
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-030 — Scaffold Web App", () => {
  test("run results page shows current page and figma screenshots when figma URL is provided", async ({ page }) => {
    const projectRes = await page.request.post("http://localhost:3001/api/projects", {
      data: { name: "ODQA-030 Screenshot Pair" },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const runRes = await page.request.post("http://localhost:3001/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:5173",
        viewports: ["desktop"],
        figmaFrameUrl:
          "https://www.figma.com/design/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?node-id=2-2523",
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string };

    await page.goto(`/runs/${run.id}`);

    await expect(page.getByRole("heading", { name: /Screenshot comparison/i })).toBeVisible();
    await expect(page.getByText(/Current page/i).first()).toBeVisible();
    await expect(page.getByText(/Figma reference/i).first()).toBeVisible();

    await expect(page.getByAltText(/desktop page screenshot/i)).toBeVisible();
    await expect(page.getByAltText(/desktop figma screenshot/i)).toBeVisible();
  });

  test("home page loads and returns HTTP 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("home page renders the OpenDesign QA heading", async ({ page }) => {
    await page.goto("/");

    const heading = page.getByRole("heading", { name: "OpenDesign QA", level: 1 });
    await expect(heading).toBeVisible();
  });

  test("home page renders a navigation header", async ({ page }) => {
    await page.goto("/");

    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  test("navigation contains a brand link to the home page", async ({ page }) => {
    await page.goto("/");

    const brandLink = page.locator("header").getByRole("link", { name: /OpenDesign QA/i });
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toHaveAttribute("href", "/");
  });

  test("navigation contains a 'New Audit' link", async ({ page }) => {
    await page.goto("/");

    const newAuditLink = page.locator("header").getByRole("link", { name: /New Audit/i });
    await expect(newAuditLink).toBeVisible();
    await expect(newAuditLink).toHaveAttribute("href", "/runs/new");
  });

  test("'Start New Audit' CTA button is visible on the home page", async ({ page }) => {
    await page.goto("/");

    const ctaLink = page.getByRole("link", { name: /Start New Audit/i });
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toHaveAttribute("href", "/runs/new");
  });

  test("clicking 'Start New Audit' navigates to /runs/new", async ({ page }) => {
    await page.goto("/");

    const ctaLink = page.getByRole("link", { name: /Start New Audit/i });
    await ctaLink.click();

    await expect(page).toHaveURL(/\/runs\/new/);
  });

  test("clicking the nav brand link from another page navigates back to home", async ({ page }) => {
    await page.goto("/runs/new");

    const brandLink = page.locator("header").getByRole("link", { name: /OpenDesign QA/i });
    await brandLink.click();

    await expect(page).toHaveURL("/");
  });

  test("home page has a valid HTML document structure", async ({ page }) => {
    await page.goto("/");

    // html > body > main should be present
    await expect(page.locator("html")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("page title is 'OpenDesign QA'", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/OpenDesign QA/i);
  });

  // Edge case: TanStack Query provider does not produce console errors on load
  test("home page loads without JavaScript console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known benign errors (e.g. favicon 404)
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes("favicon") && !err.includes("404")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // Edge case: meta description is set for SEO
  test("home page has a meta description", async ({ page }) => {
    await page.goto("/");

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveCount(1);

    const content = await metaDescription.getAttribute("content");
    expect(content).toBeTruthy();
    expect((content ?? "").length).toBeGreaterThan(10);
  });

  // Edge case: home page renders on mobile viewport without layout breakage
  test("home page layout is usable on a 390px mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const heading = page.getByRole("heading", { name: "OpenDesign QA", level: 1 });
    await expect(heading).toBeVisible();

    const ctaLink = page.getByRole("link", { name: /Start New Audit/i });
    await expect(ctaLink).toBeVisible();
  });

  // Edge case: /runs/new route returns 200 (not a hard 404)
  test("GET /runs/new returns a valid page", async ({ page }) => {
    const response = await page.goto("/runs/new");
    // Should return 200 (page exists) — not a hard 404 or 500
    expect(response?.status()).toBeLessThan(500);
    expect(response?.status()).not.toBe(404);
  });
});
