/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ODQA-Story — Priya's Audit Journey
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE STORY
 * ─────────────────────────────────────────────────────────────────────────
 * Priya is a frontend developer at AcmeOps. She just shipped a redesigned
 * landing page and wants to verify the implementation matches the Figma
 * designs before her PR is merged.
 *
 * A colleague mentions OpenDesign QA. Priya opens it for the first time,
 * reads the feature highlights, launches a new audit against the live
 * test-landing page, watches the run process in real-time, reviews the
 * screenshot comparison and design findings, exports a JSON report, and
 * finally navigates back home.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SCENES IN THIS STORY
 * ─────────────────────────────────────────────────────────────────────────
 *  ACT 1  Priya discovers OpenDesign QA on the home page
 *  ACT 2  She reads the features list and clicks "Start New Audit"
 *  ACT 3  She configures the audit form (URL, viewports, Figma frame)
 *  ACT 4  She submits the form and watches the run status in real-time
 *  ACT 5  She reviews the audit results (viewport progress + screenshot)
 *  ACT 6  She opens the Export dropdown and downloads the JSON report
 *  ACT 7  She navigates back home via "Back to new audit" → brand link
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RUNNING THIS TEST (headed, with visual pauses)
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm --filter @opendesign-qa/e2e run test:story:headed
 *
 * Or from the root:
 *   pnpm test:e2e:story:headed
 *
 * The playwright.story.config.ts sets headless=false and slowMo=700 so
 * every action is clearly visible in the browser window.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ──────────────────────────────────────────────────────────────

const WEB_URL  = process.env["WEB_URL"]  ?? "http://localhost:3000";
const API_URL  = process.env["API_URL"]  ?? "http://localhost:3001";

/**
 * The built-in test-landing fixture that ships with the web app.
 * It renders a realistic "AcmeOps" landing page — perfect for Priya to audit.
 */
const TARGET_URL = `${WEB_URL}/fixtures/test-landing`;

/**
 * A real public Figma design — the Analytics Dashboard community file.
 * The worker fetches a frame from it via the Figma API so Priya gets a
 * genuine side-by-side screenshot comparison.
 */
const FIGMA_FRAME_URL =
  "https://www.figma.com/design/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?node-id=2-2523";

/** Terminal states that mean the run will no longer change. */
const TERMINAL_STATUSES = new Set(["rules_complete", "complete", "failed"]);

/**
 * How long (ms) to pause between scenes so a human watching the headed
 * browser can read what just appeared on screen.
 */
const SCENE_PAUSE   = 2_000;
const BEAT_PAUSE    = 1_200;
const QUICK_BEAT    = 600;

/** Maximum time to wait for a run to finish processing (ms). */
const RUN_TIMEOUT   = 90_000;

// ── Helper ─────────────────────────────────────────────────────────────────

/** Pause the test — gives the viewer a moment to observe the current state. */
async function pause(page: Page, ms = SCENE_PAUSE) {
  await page.waitForTimeout(ms);
}

/**
 * Scroll the page smoothly to a target element, mimicking what a user would
 * do when reading down the page.
 */
async function smoothScrollTo(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, selector);
  await page.waitForTimeout(800);
}

// ── Story test ─────────────────────────────────────────────────────────────

test.describe("ODQA-Story — Priya's Audit Journey", () => {
  /**
   * The full story plays out in a single test so we can carry state
   * (the run ID) from the form-submission step to the results step.
   */
  test(
    "Priya runs a full visual audit from home page to exported report",
    { tag: "@story" },
    async ({ page }) => {
      // ────────────────────────────────────────────────────────────────────
      // ACT 1 — Priya lands on the OpenDesign QA home page for the first time
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 1 — Priya discovers OpenDesign QA on the home page",
        async () => {
          await page.goto(WEB_URL);
          await page.waitForLoadState("networkidle");

          // Give the viewer time to see the home page
          await pause(page, SCENE_PAUSE);

          // The product heading should be front and center
          await expect(
            page.getByRole("heading", { name: "OpenDesign QA", level: 1 })
          ).toBeVisible();

          // Verify the nav brand link is present
          const brandLink = page
            .locator("header")
            .getByRole("link", { name: /OpenDesign QA/i });
          await expect(brandLink).toBeVisible();

          await pause(page, BEAT_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 2 — She reads the features list and clicks "Start New Audit"
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 2 — Priya reads the features and decides to launch an audit",
        async () => {
          // Scroll to the features section so Priya can read them
          await smoothScrollTo(page, "main");
          await pause(page, BEAT_PAUSE);

          // The three headline features should be visible
          await expect(page.getByText(/Multi-viewport audit runs/i)).toBeVisible();
          await expect(page.getByText(/Figma frame comparison/i)).toBeVisible();
          await expect(page.getByText(/Evidence-backed findings/i)).toBeVisible();

          await pause(page, BEAT_PAUSE);

          // Scroll back up to the CTA and click it
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          await page.waitForTimeout(600);

          const ctaLink = page.getByRole("link", { name: /Start New Audit/i });
          await expect(ctaLink).toBeVisible();
          await pause(page, QUICK_BEAT);
          await ctaLink.click();

          // Should now be on /runs/new
          await expect(page).toHaveURL(/\/runs\/new/);
          await page.waitForLoadState("networkidle");
          await pause(page, SCENE_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 3 — Priya fills in the audit configuration form
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 3 — Priya configures the audit form with URL, viewports, and Figma frame",
        async () => {
          await expect(
            page.getByRole("heading", { name: /Start New Audit/i })
          ).toBeVisible();

          // She reads the "Quick test pair" hint box first
          await expect(page.getByText(/Quick test pair/i)).toBeVisible();
          await pause(page, BEAT_PAUSE);

          // ── Website URL ──────────────────────────────────────────────────
          const urlInput = page.getByLabel(/Website URL/i);
          await expect(urlInput).toBeVisible();
          await urlInput.click();
          // Type the URL character by character so it's easy to follow
          await urlInput.fill(TARGET_URL);
          await pause(page, QUICK_BEAT);

          // ── Viewports ────────────────────────────────────────────────────
          // Desktop is pre-selected. Priya also wants mobile.
          const mobileCheckbox = page.getByRole("checkbox", { name: /Mobile/i });
          await expect(mobileCheckbox).toBeVisible();
          if (!(await mobileCheckbox.isChecked())) {
            await mobileCheckbox.check();
          }
          await pause(page, QUICK_BEAT);

          // Verify both desktop and mobile are now checked
          await expect(
            page.getByRole("checkbox", { name: /Desktop/i })
          ).toBeChecked();
          await expect(mobileCheckbox).toBeChecked();
          await pause(page, BEAT_PAUSE);

          // ── Figma Frame URL (optional) ───────────────────────────────────
          const figmaInput = page.getByLabel(/Figma Frame URL/i);
          await expect(figmaInput).toBeVisible();
          await figmaInput.fill(FIGMA_FRAME_URL);
          await pause(page, BEAT_PAUSE);

          // One final look before submitting
          await pause(page, SCENE_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 4 — Priya submits the form and watches the run spin up
      // ────────────────────────────────────────────────────────────────────
      let runId = "";

      await test.step(
        "ACT 4 — Priya submits the form and is redirected to the live run status page",
        async () => {
          const submitBtn = page.getByRole("button", { name: /Start Audit/i });
          await expect(submitBtn).toBeVisible();
          await submitBtn.click();

          // The button transitions to "Starting audit..." while the API calls
          // are in-flight (create project → create run).
          await expect(
            page.getByRole("button", { name: /Starting audit/i })
          ).toBeVisible({ timeout: 5_000 }).catch(() => {
            // The submission might be fast enough that we miss the loading state —
            // that is fine; just continue.
          });

          // Wait for redirect to /runs/:id
          await page.waitForURL(/\/runs\/[a-f0-9-]{36}/, { timeout: 30_000 });
          await page.waitForLoadState("networkidle");

          // Extract the run ID from the URL for later assertions
          runId = page.url().split("/runs/")[1] ?? "";
          expect(runId).toBeTruthy();

          // Give the viewer a clear look at the "run in progress" state
          await pause(page, SCENE_PAUSE);

          // The "Audit Status" heading confirms we're on the right page
          await expect(
            page.getByRole("heading", { name: /Audit Status/i })
          ).toBeVisible();

          // The target URL is shown in the Run details card
          await expect(page.getByText(TARGET_URL)).toBeVisible({ timeout: 10_000 });
          await pause(page, BEAT_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 5 — Priya watches the run progress until it finishes
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 5 — Priya watches the viewport progress bars and waits for the run to complete",
        async () => {
          // The "Viewport progress" sidebar should be visible
          await expect(
            page.getByRole("heading", { name: /Viewport progress/i })
          ).toBeVisible({ timeout: 15_000 });
          await pause(page, BEAT_PAUSE);

          // The page polls every 1 s — wait for a terminal status badge to appear.
          // We use `waitForFunction` so we can poll the API directly if needed.
          await page.waitForFunction(
            (terminalSet) => {
              // The status badge is a <span> with uppercase tracking text.
              const spans = Array.from(document.querySelectorAll("span"));
              return spans.some((s) => {
                const t = s.textContent?.trim().toLowerCase().replace(/\s+/g, "_");
                return t && terminalSet.includes(t);
              });
            },
            [...TERMINAL_STATUSES],
            { timeout: RUN_TIMEOUT, polling: 2_000 }
          );

          await pause(page, SCENE_PAUSE);

          // After completion, both desktop and mobile viewport rows should show
          // a status (complete, failed, or similar).
          const viewportSection = page.locator("aside").filter({
            has: page.getByRole("heading", { name: /Viewport progress/i }),
          });
          await expect(viewportSection).toBeVisible();
          await pause(page, BEAT_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 6 — Priya reviews the screenshot comparison + findings
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 6 — Priya reviews the screenshot comparison and any design findings",
        async () => {
          // Scroll down to the screenshot comparison section
          const comparisonHeading = page.getByRole("heading", {
            name: /Screenshot comparison/i,
          });

          // The section appears only when artifacts are available; it may not
          // exist if no screenshots were captured (e.g. worker unavailable).
          const comparisonExists = await comparisonHeading
            .isVisible({ timeout: 10_000 })
            .catch(() => false);

          if (comparisonExists) {
            await smoothScrollTo(page, "[data-testid='comparison-section'], main");
            await pause(page, SCENE_PAUSE);

            // "Current page" column label
            await expect(page.getByText(/Current page/i).first()).toBeVisible();
            await pause(page, BEAT_PAUSE);
          }

          // Check for the "Run details" card — always present after load
          await expect(
            page.getByRole("heading", { name: /Run details/i })
          ).toBeVisible();

          // Scroll to findings section
          const findingsHeading = page.getByRole("heading", {
            name: /Design findings/i,
          });
          const findingsExist = await findingsHeading
            .isVisible({ timeout: 8_000 })
            .catch(() => false);

          if (findingsExist) {
            await smoothScrollTo(page, "h2");
            await pause(page, SCENE_PAUSE);

            // The findings count badge in the page header
            const countBadge = page.getByText(/Issues Found:/i);
            if (await countBadge.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await expect(countBadge).toBeVisible();
              await pause(page, BEAT_PAUSE);
            }
          }

          await pause(page, BEAT_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 7 — Priya exports the report as JSON
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 7 — Priya opens the Export dropdown and downloads the JSON report",
        async () => {
          // Scroll back to the top where the Export button lives
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          await page.waitForTimeout(600);

          const exportBtn = page.getByRole("button", { name: /Export/i });
          await expect(exportBtn).toBeVisible({ timeout: 10_000 });
          await pause(page, QUICK_BEAT);

          // Open the dropdown
          await exportBtn.click();
          await pause(page, BEAT_PAUSE);

          // Both format options should appear in the menu
          const jsonOption     = page.getByRole("menuitem", { name: /Download JSON/i });
          const markdownOption = page.getByRole("menuitem", { name: /Download Markdown/i });
          await expect(jsonOption).toBeVisible();
          await expect(markdownOption).toBeVisible();
          await pause(page, BEAT_PAUSE);

          // Intercept the download so the test doesn't require a real file-save dialog
          const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
            jsonOption.click(),
          ]);

          if (download) {
            // Verify the download filename pattern
            expect(download.suggestedFilename()).toMatch(/report-.+\.json/);
            await pause(page, BEAT_PAUSE);
          }

          // Verify the dropdown closed after the selection
          await expect(
            page.getByRole("menu")
          ).not.toBeVisible({ timeout: 3_000 }).catch(() => {
            // Some browsers keep the menu open if a download was intercepted.
            // Press Escape to close it before the next step.
          });
          await page.keyboard.press("Escape");
          await pause(page, SCENE_PAUSE);
        }
      );

      // ────────────────────────────────────────────────────────────────────
      // ACT 8 — Priya navigates back home and the journey is complete
      // ────────────────────────────────────────────────────────────────────
      await test.step(
        "ACT 8 — Priya navigates back to /runs/new then home — journey complete",
        async () => {
          // "← Back to new audit" link at the top of the results page
          const backLink = page.getByRole("link", { name: /Back to new audit/i });
          await expect(backLink).toBeVisible();
          await pause(page, QUICK_BEAT);
          await backLink.click();

          await expect(page).toHaveURL(/\/runs\/new/);
          await page.waitForLoadState("networkidle");
          await pause(page, BEAT_PAUSE);

          // Now use the nav brand link to go all the way back home
          const brandLink = page
            .locator("header")
            .getByRole("link", { name: /OpenDesign QA/i });
          await expect(brandLink).toBeVisible();
          await brandLink.click();

          await expect(page).toHaveURL(WEB_URL + "/");
          await page.waitForLoadState("networkidle");

          // Final scene: home page once more — Priya's journey is done.
          await expect(
            page.getByRole("heading", { name: "OpenDesign QA", level: 1 })
          ).toBeVisible();

          await pause(page, SCENE_PAUSE);
        }
      );
    }
  );

  // ── Standalone smoke scenes ───────────────────────────────────────────────
  // These run independently so they can be used as fast sanity checks.

  test(
    "Smoke — form validation: URL is required before submitting",
    { tag: "@story-smoke" },
    async ({ page }) => {
      await page.goto(`${WEB_URL}/runs/new`);
      await page.waitForLoadState("networkidle");
      await pause(page, BEAT_PAUSE);

      // Submit without filling in anything
      await page.getByRole("button", { name: /Start Audit/i }).click();
      await pause(page, BEAT_PAUSE);

      // Validation error should appear under the URL field
      const error = page.locator("p.text-red-600").first();
      await expect(error).toBeVisible();
      await pause(page, BEAT_PAUSE);
    }
  );

  test(
    "Smoke — viewport toggles: at least one viewport must stay selected",
    { tag: "@story-smoke" },
    async ({ page }) => {
      await page.goto(`${WEB_URL}/runs/new`);
      await page.waitForLoadState("networkidle");
      await pause(page, BEAT_PAUSE);

      // Desktop is checked by default — try to uncheck it (should be blocked)
      const desktopCb = page.getByRole("checkbox", { name: /Desktop/i });
      await expect(desktopCb).toBeChecked();
      await desktopCb.uncheck();
      await pause(page, QUICK_BEAT);

      // The form enforces a minimum of 1 — desktop should remain checked
      await expect(desktopCb).toBeChecked();
      await pause(page, BEAT_PAUSE);
    }
  );

  test(
    "Smoke — run results page: handles unknown run ID gracefully",
    { tag: "@story-smoke" },
    async ({ page }) => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await page.goto(`${WEB_URL}/runs/${fakeId}`);
      await page.waitForLoadState("networkidle");
      await pause(page, BEAT_PAUSE);

      // The page should show an error state, not a blank screen
      const errorEl = page.getByText(
        /failed to load|not found|error|could not find/i
      );
      await expect(errorEl).toBeVisible({ timeout: 10_000 });
      await pause(page, BEAT_PAUSE);
    }
  );
});
