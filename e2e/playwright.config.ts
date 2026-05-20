import { defineConfig, devices } from "@playwright/test";

const WEB_URL = process.env["WEB_URL"] ?? "http://localhost:3000";
const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

// Only start the dev servers if not already running (CI skips via env var)
const startServers = process.env["CI_NO_WEBSERVER"] !== "1";
// Always reuse existing server for local dev/testing
const reuseExistingServer = true;

export default defineConfig({
  testDir: "./tests",
  testMatch: [
    /odqa-001-005\.monorepo-environment\.spec\.ts/,
    /odqa-006-013\.capture-data-layer\.spec\.ts/,
    /odqa-014\.api-health\.spec\.ts/,
    /odqa-015-017\.api-projects-runs\.spec\.ts/,
    /odqa-018-020\.worker-queue\.spec\.ts/,
    /odqa-021-022\.rule-engine\.spec\.ts/,
    /odqa-023-029\.web-rules\.spec\.ts/,
    /odqa-030\.web-shell\.spec\.ts/,
  ],
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: process.env["CI"] ? "github" : "list",
  timeout: 30_000,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: startServers
    ? [
        {
          command: "node --experimental-strip-types ../apps/api/src/index.ts",
          url: `${API_URL}/health`,
          reuseExistingServer,
          timeout: 30_000,
          env: {
            ODQA_START_SERVER: "1",
            API_PORT: "3001",
            NODE_ENV: "test",
          },
          stdout: "ignore",
          stderr: "ignore",
        },
        {
          command: "pnpm --filter @opendesign-qa/web run dev",
          url: WEB_URL,
          reuseExistingServer,
          timeout: 60_000,
          env: {
            NODE_ENV: "test",
          },
          stdout: "ignore",
          stderr: "ignore",
        },
      ]
    : undefined,
  projects: [
    {
      name: "api",
      testMatch: [
        /odqa-001-005\.monorepo-environment\.spec\.ts/,
        /odqa-006-013\.capture-data-layer\.spec\.ts/,
        /odqa-014\.api-health\.spec\.ts/,
        /odqa-015-017\.api-projects-runs\.spec\.ts/,
        /odqa-018-020\.worker-queue\.spec\.ts/,
        /odqa-021-022\.rule-engine\.spec\.ts/,
        /odqa-023-029\.web-rules\.spec\.ts/,
      ],
      use: {
        baseURL: API_URL,
        extraHTTPHeaders: {
          "Content-Type": "application/json",
        },
      },
    },
    {
      name: "web-chrome",
      testMatch: [/odqa-030\.web-shell\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WEB_URL,
      },
    },
    {
      name: "web-firefox",
      testMatch: [/odqa-030\.web-shell\.spec\.ts/],
      use: {
        ...devices["Desktop Firefox"],
        baseURL: WEB_URL,
      },
    },
    {
      name: "web-edge",
      testMatch: [/odqa-030\.web-shell\.spec\.ts/],
      use: {
        ...devices["Desktop Edge"],
        baseURL: WEB_URL,
      },
    },
    {
      name: "mobile-chrome",
      testMatch: [/odqa-030\.web-shell\.spec\.ts/],
      use: {
        ...devices["Pixel 5"],
        baseURL: WEB_URL,
      },
    },
    {
      name: "mobile-safari",
      testMatch: [/odqa-030\.web-shell\.spec\.ts/],
      use: {
        ...devices["iPhone 12"],
        baseURL: WEB_URL,
      },
    },
  ],
});
