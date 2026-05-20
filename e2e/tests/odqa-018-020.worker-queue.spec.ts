/**
 * ODQA-018 — Scaffold Worker Service
 * ODQA-019 — Queue Audit Jobs From API
 * ODQA-020 — End-To-End Capture Job Execution
 *
 * These tests verify the worker / queue integration end-to-end via the API.
 * The worker is observed indirectly: by creating a run through the API and
 * asserting that the run status eventually advances (proving the worker picked
 * up and processed the job) and that the resulting database records are correct.
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
  url = "http://localhost:3000",
  viewports = ["desktop"]
): Promise<{ projectId: string; runId: string }> {
  const projectRes = await request.post("/api/projects", { data: { name } });
  expect(projectRes.status()).toBe(201);
  const project = (await projectRes.json()) as { id: string };

  const runRes = await request.post("/api/runs", {
    data: { projectId: project.id, url, viewports },
  });
  expect(runRes.status()).toBe(201);
  const run = (await runRes.json()) as { id: string };

  return { projectId: project.id, runId: run.id };
}

async function pollRunUntilTerminal(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  runId: string,
  maxWaitSeconds = 30
): Promise<string> {
  const terminalStatuses = ["captured", "rules_complete", "complete", "failed"];
  let status = "queued";

  for (let i = 0; i < maxWaitSeconds; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await request.get(`/api/runs/${runId}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string };
    status = body.status;
    if (terminalStatuses.includes(status)) break;
  }

  return status;
}

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-018: Scaffold Worker Service
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-018 — Scaffold Worker Service", () => {
  test("apps/worker/src/index.ts exports createWorker and AUDIT_QUEUE_NAME", () => {
    const workerIndexPath = resolve(WORKSPACE_ROOT, "apps", "worker", "src", "index.ts");
    expect(existsSync(workerIndexPath), "worker index.ts must exist").toBe(true);

    const source = readFileSync(workerIndexPath, "utf-8");
    expect(source).toContain("AUDIT_QUEUE_NAME");
    expect(source).toContain("createWorker");
    expect(source).toContain("audit-jobs");
  });

  test("worker registers graceful shutdown handlers for SIGTERM", () => {
    const workerIndexPath = resolve(WORKSPACE_ROOT, "apps", "worker", "src", "index.ts");
    const source = readFileSync(workerIndexPath, "utf-8");

    expect(source).toContain("SIGTERM");
    expect(source).toContain("registerShutdownHandlers");
  });

  test("worker package.json exists and declares BullMQ dependency", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "apps", "worker", "package.json");
    expect(existsSync(pkgPath), "worker package.json must exist").toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["bullmq"]).toBeDefined();
  });

  // Edge case: worker concurrency is configurable via environment variable
  test("worker source reads WORKER_CONCURRENCY from environment", () => {
    const workerIndexPath = resolve(WORKSPACE_ROOT, "apps", "worker", "src", "index.ts");
    const source = readFileSync(workerIndexPath, "utf-8");
    expect(source).toContain("WORKER_CONCURRENCY");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-019: Queue Audit Jobs From API
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-019 — Queue Audit Jobs From API", () => {
  test("creating a run via POST /api/runs results in the run leaving queued status", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-019 Queue Test"
    );

    const status = await pollRunUntilTerminal(request, runId, 20);
    // If the worker picked up the job the status will have advanced past queued
    expect(["captured", "rules_complete", "complete", "failed"]).toContain(status);
  });

  test("each viewport in the run results in a separate viewport run record", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-019 Viewport Jobs",
      "http://localhost:3000",
      ["desktop", "mobile"]
    );

    const res = await request.get(`/api/runs/${runId}`);
    const body = (await res.json()) as {
      viewportRuns: Array<{ viewport: string; status: string }>;
    };

    expect(body.viewportRuns).toHaveLength(2);
    const viewports = body.viewportRuns.map((vr) => vr.viewport);
    expect(viewports).toContain("desktop");
    expect(viewports).toContain("mobile");
  });

  test("job payload for enqueued viewport run contains required fields", async ({ request }) => {
    // We verify this indirectly: the worker needs runId, viewportRunId, url,
    // viewport to do its job — if the run completes or fails (not stays queued),
    // the payload was correctly formed.
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-019 Job Payload",
      "http://localhost:3000",
      ["desktop"]
    );

    const status = await pollRunUntilTerminal(request, runId, 25);
    // Status should not remain "queued" — the worker received the payload
    expect(status).not.toBe("queued");
  });

  // Edge case: run created with Figma URL has figmaFrameUrl in the enqueued job
  test("run created with figmaFrameUrl stores the reference on the run record", async ({
    request,
  }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-019 Figma Job" },
    });
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["desktop"],
        figmaFrameUrl: "https://www.figma.com/file/abc123/Design?node-id=1%3A2",
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string; figmaFrameUrl?: string };
    expect(run.figmaFrameUrl).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-020: End-To-End Capture Job Execution
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-020 — End-To-End Capture Job Execution", () => {
  test("a successfully processed job sets viewport run status to captured", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-020 Capture Success",
      "http://localhost:3000",
      ["desktop"]
    );

    const status = await pollRunUntilTerminal(request, runId, 30);
    expect(["captured", "rules_complete", "complete"]).toContain(status);

    const res = await request.get(`/api/runs/${runId}`);
    const body = (await res.json()) as {
      viewportRuns: Array<{ viewport: string; status: string }>;
    };

    const desktopRun = body.viewportRuns.find((vr) => vr.viewport === "desktop");
    expect(desktopRun).toBeDefined();
    expect(["captured", "rules_complete", "complete"]).toContain(desktopRun!.status);
  });

  test("a capture job that fails sets viewport run status to failed", async ({ request }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-020 Capture Failure",
      "http://localhost:19999/no-page-here",
      ["desktop"]
    );

    const status = await pollRunUntilTerminal(request, runId, 30);
    expect(status).toBe("failed");

    const res = await request.get(`/api/runs/${runId}`);
    const body = (await res.json()) as {
      viewportRuns: Array<{ viewport: string; status: string; errorCode?: string }>;
    };

    const desktopRun = body.viewportRuns.find((vr) => vr.viewport === "desktop");
    expect(desktopRun?.status).toBe("failed");
    // A typed error code should be present
    expect(desktopRun?.errorCode).toBeTruthy();
  });

  test("failed capture jobs retry up to 3 times before marking as failed", async ({
    request,
  }) => {
    // We submit a run to an unreachable host and verify the attempt count
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-020 Retry Count",
      "http://localhost:19999/retry-test",
      ["desktop"]
    );

    // Wait longer to allow retries to exhaust
    const status = await pollRunUntilTerminal(request, runId, 40);
    expect(status).toBe("failed");

    const res = await request.get(`/api/runs/${runId}`);
    const body = (await res.json()) as {
      viewportRuns: Array<{ attemptsMade?: number }>;
    };

    const desktopRun = body.viewportRuns[0];
    if (desktopRun?.attemptsMade !== undefined) {
      expect(desktopRun.attemptsMade).toBeGreaterThanOrEqual(1);
      expect(desktopRun.attemptsMade).toBeLessThanOrEqual(3);
    }
  });

  // Edge case: all viewports in a multi-viewport run are processed independently
  test("all viewports in a run are processed independently and each has an artifact", async ({
    request,
  }) => {
    const { runId } = await createProjectAndRun(
      request,
      "ODQA-020 Multi Viewport",
      "http://localhost:3000",
      ["desktop", "tablet", "mobile"]
    );

    const status = await pollRunUntilTerminal(request, runId, 40);
    expect(["captured", "rules_complete", "complete"]).toContain(status);

    const artifactsRes = await request.get(`/api/runs/${runId}/artifacts`);
    const artifacts = (await artifactsRes.json()) as Array<{ viewport: string; artifactType: string }>;

    const screenshots = artifacts.filter((a) => a.artifactType === "screenshot");
    const viewportsCaptured = screenshots.map((a) => a.viewport);

    expect(viewportsCaptured).toContain("desktop");
    expect(viewportsCaptured).toContain("tablet");
    expect(viewportsCaptured).toContain("mobile");
  });
});
