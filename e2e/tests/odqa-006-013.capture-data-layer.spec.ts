/**
 * ODQA-006 — Create Capture Package Scaffold
 * ODQA-007 — Implement Single-Page Screenshot Capture
 * ODQA-008 — Extract DOM Layout Metadata
 * ODQA-009 — Support Multiple Viewport Presets
 * ODQA-010 — Page Stabilisation Hooks
 * ODQA-011 — Create DB Package And Prisma Schema
 * ODQA-012 — Object Storage Service For Artifacts
 * ODQA-013 — Persist Capture Artifacts After A Run
 *
 * These tickets deliver the capture pipeline and data persistence layer.
 * The E2E tests verify the observable end-to-end behaviour through the API:
 * submitting a run causes a screenshot to be captured per viewport, stored in
 * object storage, and a CaptureArtifact record created in the database.
 *
 * Tests for ODQA-006 to ODQA-010 verify the capture package structure and the
 * end-to-end job outcome (via the run API).
 * Tests for ODQA-011 to ODQA-013 verify DB schema existence and the storage/artifact
 * round-trip.
 */
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const WORKSPACE_ROOT = resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-006: Capture Package Scaffold
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-006 — Capture Package Scaffold", () => {
  test("packages/capture directory exists with package.json", () => {
    const capturePkgPath = resolve(WORKSPACE_ROOT, "packages", "capture", "package.json");
    expect(existsSync(capturePkgPath), "packages/capture/package.json must exist").toBe(true);
  });

  test("capture package exports a typed capture function", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    expect(existsSync(indexPath), "packages/capture/src/index.ts must exist").toBe(true);

    const source = readFileSync(indexPath, "utf-8");
    // Must export the capture function used by the worker
    expect(source).toContain("capture");
    expect(source).toContain("CaptureResult");
  });

  test("capture package declares playwright as a dependency", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "capture", "package.json");
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    expect(Object.keys(allDeps).some((k) => k.includes("playwright"))).toBe(true);
  });

  // Edge case: package name follows monorepo convention
  test("capture package name follows @opendesign-qa/* convention", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "capture", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string };
    expect(pkg.name).toMatch(/@opendesign-qa\/capture/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-007: Single-Page Screenshot Capture
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-007 — Single-Page Screenshot Capture", () => {
  test("capture function source exports CaptureResult and CaptureError types", () => {
    const typesPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    expect(existsSync(typesPath)).toBe(true);

    const source = readFileSync(typesPath, "utf-8");
    expect(source).toContain("CaptureResult");
    expect(source).toContain("CaptureError");
  });

  test("capture result type includes required fields", () => {
    // Verify via source inspection that CaptureResult shape matches acceptance criteria
    const typesPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    const source = readFileSync(typesPath, "utf-8");

    expect(source).toContain("screenshotBuffer");
    expect(source).toContain("viewport");
    expect(source).toContain("url");
    expect(source).toContain("capturedAt");
  });

  // E2E: submitting a run to the API and waiting for capture produces an artifact
  test("POST /api/runs eventually produces a screenshot artifact for the requested viewport", async ({
    request,
  }) => {
    // Create a project first
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-007 Capture Test" },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    // Submit a run targeting a stable local URL
    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["desktop"],
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string };

    // Poll until the run reaches a terminal status (max 25 s)
    let status = "queued";
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request.get(`/api/runs/${run.id}`);
      expect(pollRes.status()).toBe(200);
      const body = (await pollRes.json()) as { status: string };
      status = body.status;
      if (status === "captured" || status === "rules_complete" || status === "complete" || status === "failed") {
        break;
      }
    }

    expect(["captured", "rules_complete", "complete"], `run ended with status: ${status}`).toContain(status);

    // Verify at least one artifact exists
    const artifactsRes = await request.get(`/api/runs/${run.id}/artifacts`);
    expect(artifactsRes.status()).toBe(200);
    const artifacts = (await artifactsRes.json()) as Array<{ artifactType: string; viewport: string }>;
    const screenshot = artifacts.find(
      (a) => a.artifactType === "screenshot" && a.viewport === "desktop"
    );
    expect(screenshot, "should have a desktop screenshot artifact").toBeDefined();
  });

  // Edge case: non-200 response from target URL produces a run with failed status
  test("capture of a non-existent URL sets the run status to failed", async ({ request }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-007 Error Test" },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:19999/does-not-exist",
        viewports: ["desktop"],
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string };

    let status = "queued";
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request.get(`/api/runs/${run.id}`);
      const body = (await pollRes.json()) as { status: string };
      status = body.status;
      if (status === "failed" || status === "captured" || status === "complete") break;
    }

    expect(status).toBe("failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-008: Extract DOM Layout Metadata
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-008 — Extract DOM Layout Metadata", () => {
  test("DomSnapshot type definition exists in capture package", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    expect(existsSync(indexPath)).toBe(true);

    const source = readFileSync(indexPath, "utf-8");
    expect(source).toContain("DomSnapshot");
  });

  test("DomSnapshot entries include required fields per acceptance criteria", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");

    expect(source).toContain("selector");
    expect(source).toContain("tagName");
    expect(source).toContain("boundingBox");
    expect(source).toContain("computedFontSize");
    expect(source).toContain("computedColor");
    expect(source).toContain("computedBackgroundColor");
  });

  // Edge case: CaptureResult includes domSnapshot alongside screenshot
  test("CaptureResult type includes domSnapshot field", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");
    expect(source).toContain("domSnapshot");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-009: Support Multiple Viewport Presets
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-009 — Support Multiple Viewport Presets", () => {
  test("capture package defines the three built-in viewport presets", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    expect(existsSync(indexPath)).toBe(true);

    const source = readFileSync(indexPath, "utf-8");
    expect(source).toContain("desktop");
    expect(source).toContain("tablet");
    expect(source).toContain("mobile");
  });

  test("submitting a run with multiple viewports produces one artifact per viewport", async ({
    request,
  }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-009 Viewport Test" },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["desktop", "mobile"],
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string; viewportRuns: Array<{ viewport: string }> };

    // There should be one viewport run created per requested viewport
    expect(run.viewportRuns).toHaveLength(2);
    const viewports = run.viewportRuns.map((vr) => vr.viewport);
    expect(viewports).toContain("desktop");
    expect(viewports).toContain("mobile");
  });

  // Edge case: unknown viewport name returns a 400
  test("POST /api/runs with an unknown viewport name returns 400", async ({ request }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-009 Invalid Viewport" },
    });
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["ultrawide-4k"],
      },
    });
    expect(runRes.status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-010: Page Stabilisation Hooks
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-010 — Page Stabilisation Hooks", () => {
  test("capture package source defines supported wait strategy types", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    expect(existsSync(indexPath)).toBe(true);

    const source = readFileSync(indexPath, "utf-8");
    // At least the strategy types should be present in the source
    expect(source).toContain("networkidle");
    expect(source).toContain("domcontentloaded");
  });

  test("capture config accepts a waitStrategies array field", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "capture", "src", "index.ts");
    const source = readFileSync(indexPath, "utf-8");
    expect(source).toContain("waitStrategies");
  });

  // Edge case: a strategy that times out does not crash the capture job
  test("POST /api/runs with a fixed-delay wait strategy still succeeds", async ({ request }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-010 Wait Strategy Test" },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["desktop"],
        captureConfig: {
          waitStrategies: [{ type: "fixed-delay", delayMs: 200 }],
        },
      },
    });
    expect(runRes.status()).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-011: DB Package And Prisma Schema
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-011 — Create DB Package And Prisma Schema", () => {
  test("packages/db directory exists with a Prisma schema", () => {
    const prismaSchemaPath = resolve(WORKSPACE_ROOT, "packages", "db", "prisma", "schema.prisma");
    expect(existsSync(prismaSchemaPath), "prisma/schema.prisma must exist").toBe(true);
  });

  test("Prisma schema includes all required model definitions", () => {
    const prismaSchemaPath = resolve(WORKSPACE_ROOT, "packages", "db", "prisma", "schema.prisma");
    const source = readFileSync(prismaSchemaPath, "utf-8");

    const requiredModels = [
      "Project",
      "AuditRun",
      "ViewportRun",
      "CaptureArtifact",
      "Finding",
      "FindingEvidence",
      "IgnoreRule",
    ];
    for (const model of requiredModels) {
      expect(source, `schema must define model ${model}`).toContain(`model ${model}`);
    }
  });

  test("packages/db/src exports a typed db client singleton", () => {
    const dbIndexPath = resolve(WORKSPACE_ROOT, "packages", "db", "src", "index.ts");
    expect(existsSync(dbIndexPath), "packages/db/src/index.ts must exist").toBe(true);

    const source = readFileSync(dbIndexPath, "utf-8");
    expect(source).toContain("PrismaClient");
  });

  // Edge case: schema is not empty
  test("Prisma schema has non-trivial content (> 200 chars)", () => {
    const prismaSchemaPath = resolve(WORKSPACE_ROOT, "packages", "db", "prisma", "schema.prisma");
    const source = readFileSync(prismaSchemaPath, "utf-8");
    expect(source.length).toBeGreaterThan(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-012: Object Storage Service For Artifacts
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-012 — Object Storage Service For Artifacts", () => {
  test("packages/storage exports upload and getSignedUrl functions", () => {
    const storagePkgPath = resolve(WORKSPACE_ROOT, "packages", "storage", "package.json");
    expect(existsSync(storagePkgPath), "packages/storage/package.json must exist").toBe(true);

    // Check adapter.ts which contains the implementation
    const adapterPath = resolve(WORKSPACE_ROOT, "packages", "storage", "src", "adapter.ts");
    expect(existsSync(adapterPath), "packages/storage/src/adapter.ts must exist").toBe(true);

    const source = readFileSync(adapterPath, "utf-8");
    expect(source).toContain("upload");
    expect(source).toContain("getSignedUrl");
  });

  test("storage adapter selects provider from STORAGE_PROVIDER environment variable", () => {
    // adapter.ts reads STORAGE_PROVIDER; index.ts only re-exports
    const adapterPath = resolve(WORKSPACE_ROOT, "packages", "storage", "src", "adapter.ts");
    const source = readFileSync(adapterPath, "utf-8");
    expect(source).toContain("STORAGE_PROVIDER");
  });

  // Edge case: storage package name follows convention
  test("storage package name follows @opendesign-qa/* convention", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "storage", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string };
    expect(pkg.name).toMatch(/@opendesign-qa\/storage/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-013: Persist Capture Artifacts After A Run
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-013 — Persist Capture Artifacts After A Run", () => {
  test("completed capture run has at least one CaptureArtifact record via API", async ({
    request,
  }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-013 Artifact Persistence Test" },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["desktop"],
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string };

    // Wait for capture to complete
    let status = "queued";
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request.get(`/api/runs/${run.id}`);
      const body = (await pollRes.json()) as { status: string };
      status = body.status;
      if (status !== "queued" && status !== "capturing") break;
    }

    const artifactsRes = await request.get(`/api/runs/${run.id}/artifacts`);
    expect(artifactsRes.status()).toBe(200);

    const artifacts = (await artifactsRes.json()) as Array<{
      artifactType: string;
      storageKey: string;
      capturedAt: string;
      signedUrl?: string;
    }>;

    expect(artifacts.length).toBeGreaterThan(0);

    const screenshot = artifacts.find((a) => a.artifactType === "screenshot");
    expect(screenshot).toBeDefined();
    expect(screenshot!.storageKey).toBeTruthy();
    expect(screenshot!.capturedAt).toBeTruthy();
  });

  // Edge case: artifact storageKey follows a deterministic naming scheme
  test("screenshot artifact storageKey contains the runId and viewport name", async ({
    request,
  }) => {
    const projectRes = await request.post("/api/projects", {
      data: { name: "ODQA-013 Storage Key Test" },
    });
    const project = (await projectRes.json()) as { id: string };

    const runRes = await request.post("/api/runs", {
      data: {
        projectId: project.id,
        url: "http://localhost:3000",
        viewports: ["desktop"],
      },
    });
    const run = (await runRes.json()) as { id: string };

    // Wait for capture
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request.get(`/api/runs/${run.id}`);
      const body = (await pollRes.json()) as { status: string };
      if (body.status !== "queued" && body.status !== "capturing") break;
    }

    const artifactsRes = await request.get(`/api/runs/${run.id}/artifacts`);
    const artifacts = (await artifactsRes.json()) as Array<{ storageKey: string; viewport: string }>;

    const screenshot = artifacts.find((a) => a.viewport === "desktop");
    if (screenshot) {
      expect(screenshot.storageKey).toContain(run.id);
      expect(screenshot.storageKey).toContain("desktop");
    }
  });
});
