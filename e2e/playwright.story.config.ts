/**
 * Playwright config for the story-based headed browser tests.
 *
 * Designed to be easy to watch:
 *   • headless = false  — real visible browser window
 *   • slowMo = 700 ms   — each Playwright action is slowed down
 *   • viewport pauses   — the test itself adds waitForTimeout() beats
 *   • timeout = 120 s   — generous limit for real API runs to finish
 *
 * Usage:
 *   pnpm --filter @opendesign-qa/e2e run test:story:headed
 *   # or from the monorepo root:
 *   pnpm test:e2e:story:headed
 *
 * Assumes both servers are already running locally:
 *   pnpm dev:api   → http://localhost:3001
 *   pnpm dev:web   → http://localhost:3000
 */

import { defineConfig, devices } from "@playwright/test";

const WEB_URL = process.env["WEB_URL"] ?? "http://localhost:3000";
const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

const slowMo = process.env["SLOW_MO"]
  ? parseInt(process.env["SLOW_MO"], 10)
  : 700;

export default defineConfig({
  testDir: "./tests",
  testMatch: [/odqa-story\..*\.spec\.ts/],
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-story", open: "never" }],
  ],
  // Give each test 2 minutes — a real audit run can take ~30–60 s
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: WEB_URL,
    headless: false,
    // Slow every Playwright action so the viewer can follow along
    launchOptions: {
      slowMo,
    },
    // Capture a full trace for every run (great for post-mortem review)
    trace: "on",
    screenshot: "on",
    video: "on",
    viewport: { width: 1440, height: 900 },
    // Generous action timeout for network-heavy steps
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },

  projects: [
    {
      name: "story-chrome",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WEB_URL,
      },
    },
  ],

  // Reuse already-running dev servers — start them first with `pnpm dev`
  webServer: [
    {
      command: "node --experimental-strip-types ../apps/api/src/index.ts",
      url: `${API_URL}/health`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        ODQA_START_SERVER: "1",
        API_PORT: "3001",
        NODE_ENV: "development",
        REDIS_URL: process.env["REDIS_URL"] ?? "redis://127.0.0.1:6381",
        DATABASE_URL:
          process.env["DATABASE_URL"] ??
          "postgresql://opendesign:opendesign@localhost:5432/opendesign_qa",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @opendesign-qa/web run dev",
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
