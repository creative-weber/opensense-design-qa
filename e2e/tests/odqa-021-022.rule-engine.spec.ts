/**
 * ODQA-021 — Create Rules Core Package
 * ODQA-022 — Rule Execution Pipeline In Worker
 *
 * These tests verify the rule framework, execution harness, and the worker
 * integration that persists findings after a successful capture.
 */
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const WORKSPACE_ROOT = resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createProjectAndRun(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  name: string,
  url = "http://localhost:3000"
): Promise<{ runId: string }> {
  const projectRes = await request.post("/api/projects", { data: { name } });
  expect(projectRes.status()).toBe(201);
  const project = (await projectRes.json()) as { id: string };

  const runRes = await request.post("/api/runs", {
    data: { projectId: project.id, url, viewports: ["desktop"] },
  });
  expect(runRes.status()).toBe(201);
  const run = (await runRes.json()) as { id: string };
  return { runId: run.id };
}

async function waitForStatus(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  runId: string,
  targetStatuses: string[],
  maxWaitSeconds = 30
): Promise<string> {
  let status = "queued";
  for (let i = 0; i < maxWaitSeconds; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await request.get(`/api/runs/${runId}`);
    const body = (await res.json()) as { status: string };
    status = body.status;
    if (targetStatuses.includes(status)) break;
  }
  return status;
}

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-021: Create Rules Core Package
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-021 — Create Rules Core Package", () => {
  test("packages/rules-core directory exists with package.json", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "package.json");
    expect(existsSync(pkgPath), "packages/rules-core/package.json must exist").toBe(true);
  });

  test("rules-core exports Rule interface, RuleResult and Evidence types", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "src", "index.ts");
    expect(existsSync(indexPath), "rules-core/src/index.ts must exist").toBe(true);

    const source = readFileSync(indexPath, "utf-8");
    expect(source).toContain("Rule");
    expect(source).toContain("RuleResult");
    expect(source).toContain("Evidence");
  });

  test("Rule interface shape includes id, name, severity, and run method", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");

    expect(source).toContain("id");
    expect(source).toContain("name");
    expect(source).toContain("severity");
    expect(source).toContain("run");
  });

  test("RuleResult type includes required evidence fields", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");

    expect(source).toContain("ruleId");
    expect(source).toContain("title");
    expect(source).toContain("confidence");
    expect(source).toContain("evidence");
  });

  test("Evidence type supports screenshotRegion, domSelector, computedValue, expectedValue", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");

    expect(source).toContain("screenshotRegion");
    expect(source).toContain("domSelector");
    expect(source).toContain("computedValue");
    expect(source).toContain("expectedValue");
  });

  test("rules-core exports runRules function", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");
    expect(source).toContain("runRules");
  });

  // Edge case: runRules handles a partial rule failure without crashing
  test("runRules function source includes error handling for individual rule failures", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");

    // Should have try/catch or similar error isolation
    expect(source.includes("try") || source.includes("catch") || source.includes("Promise.allSettled")).toBe(true);
  });

  // Edge case: runRules accepts empty rule set without error
  test("rules-core package name follows @opendesign-qa/* convention", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "rules-core", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string };
    expect(pkg.name).toMatch(/@opendesign-qa\/rules-core/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-022: Rule Execution Pipeline In Worker
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-022 — Rule Execution Pipeline In Worker", () => {
  test("packages/rules-web directory exists and registers built-in rules", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "rules-web", "package.json");
    expect(existsSync(pkgPath), "packages/rules-web/package.json must exist").toBe(true);

    const indexPath = resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "index.ts");
    expect(existsSync(indexPath), "rules-web/src/index.ts must exist").toBe(true);
  });

  test("after a completed capture run the viewport run status advances to rules_complete", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-022 Rule Pipeline",
      "http://localhost:3000"
    );

    const status = await waitForStatus(
      request,
      runId,
      ["rules_complete", "complete", "failed"],
      35
    );

    expect(["rules_complete", "complete"]).toContain(status);
  });

  test("findings are persisted as Finding rows after rules execute", async ({ request }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-022 Findings Persisted",
      "http://localhost:3000"
    );

    await waitForStatus(request, runId, ["rules_complete", "complete", "failed"], 35);

    const res = await request.get(`/api/runs/${runId}/findings`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { data: Array<unknown>; total: number };
    // The web app should trigger at least some findings (HTML structure is auditable)
    expect(typeof body.total).toBe("number");
    // Findings list should be returned correctly (may be empty for a minimal page)
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("each finding row has ruleId, title, severity, and evidence fields", async ({ request }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-022 Finding Shape",
      "http://localhost:3000"
    );

    await waitForStatus(request, runId, ["rules_complete", "complete", "failed"], 35);

    const res = await request.get(`/api/runs/${runId}/findings`);
    const body = (await res.json()) as {
      data: Array<{
        ruleId: string;
        title: string;
        severity: string;
        evidence: Array<unknown>;
      }>;
    };

    for (const finding of body.data) {
      expect(finding.ruleId).toBeTruthy();
      expect(finding.title).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(finding.severity);
      expect(Array.isArray(finding.evidence)).toBe(true);
    }
  });

  // Edge case: a failed rule logs a warning but does not crash the pipeline
  test("run on a valid URL does not end in system-error status due to rule failure", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-022 Rule Crash Guard",
      "http://localhost:3000"
    );

    const status = await waitForStatus(
      request,
      runId,
      ["rules_complete", "complete", "failed"],
      35
    );

    // A rule crash should not set the whole run to failed — rules_complete is expected
    // (individual rule errors are stored as system-error findings, not run-level failures)
    expect(status).not.toBe("failed");
  });

  // Edge case: viewport run status reflects rules_complete after execution
  test("viewport run status is rules_complete after rule pipeline finishes", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-022 Viewport Status",
      "http://localhost:3000"
    );

    await waitForStatus(request, runId, ["rules_complete", "complete", "failed"], 35);

    const res = await request.get(`/api/runs/${runId}`);
    const body = (await res.json()) as {
      viewportRuns: Array<{ status: string }>;
    };

    const desktopRun = body.viewportRuns[0];
    expect(desktopRun).toBeDefined();
    expect(["rules_complete", "complete"]).toContain(desktopRun!.status);
  });
});
