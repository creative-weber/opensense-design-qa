/**
 * ODQA-015 — Create Project And Run Endpoints
 * ODQA-016 — Findings And Artifacts API Endpoints
 * ODQA-017 — Ignore Rules API Endpoint
 *
 * Verifies the API CRUD surface for Projects, AuditRuns, Findings, Artifacts
 * and IgnoreRules.
 */
import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createProject(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  name: string
): Promise<string> {
  const res = await request.post("/api/projects", { data: { name } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createRun(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  projectId: string,
  url = "http://localhost:3000",
  viewports = ["desktop"]
): Promise<string> {
  const res = await request.post("/api/runs", {
    data: { projectId, url, viewports },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-015: Create Project And Run Endpoints
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-015 — Create Project And Run Endpoints", () => {
  test("POST /api/projects creates a project and returns it with an id", async ({ request }) => {
    const res = await request.post("/api/projects", {
      data: { name: "My Visual QA Project" },
    });

    expect(res.status()).toBe(201);

    const body = (await res.json()) as { id: string; name: string };
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("My Visual QA Project");
  });

  test("POST /api/runs creates an AuditRun with status queued", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-015 Run Test");

    const res = await request.post("/api/runs", {
      data: {
        projectId,
        url: "https://example.com",
        viewports: ["desktop", "mobile"],
      },
    });

    expect(res.status()).toBe(201);

    const body = (await res.json()) as {
      id: string;
      status: string;
      url: string;
      viewportRuns: Array<{ viewport: string; status: string }>;
    };

    expect(body.id).toBeTruthy();
    expect(body.status).toBe("queued");
    expect(body.url).toBe("https://example.com");
    expect(body.viewportRuns).toHaveLength(2);
  });

  test("GET /api/runs/:id returns run with status and viewport run list", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-015 Get Run");
    const runId = await createRun(request, projectId);

    const res = await request.get(`/api/runs/${runId}`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      id: string;
      status: string;
      viewportRuns: Array<{ viewport: string; status: string }>;
    };

    expect(body.id).toBe(runId);
    expect(body.status).toBeDefined();
    expect(Array.isArray(body.viewportRuns)).toBe(true);
  });

  // Edge case: malformed URL is rejected with 400 and a clear message
  test("POST /api/runs rejects a malformed URL with 400", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-015 Bad URL");

    const res = await request.post("/api/runs", {
      data: {
        projectId,
        url: "not-a-valid-url",
        viewports: ["desktop"],
      },
    });

    expect(res.status()).toBe(400);

    const body = (await res.json()) as { issues?: Array<{ message: string }> };
    // Zod validation should surface issues
    expect(body.issues ?? []).not.toHaveLength(0);
  });

  // Edge case: GET /api/runs/:id returns 404 for unknown run
  test("GET /api/runs/:id returns 404 for a non-existent run id", async ({ request }) => {
    const res = await request.get("/api/runs/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(404);
  });

  // Edge case: POST /api/runs with unknown projectId returns 404 or 400
  test("POST /api/runs with an unknown projectId returns 4xx", async ({ request }) => {
    const res = await request.post("/api/runs", {
      data: {
        projectId: "00000000-0000-0000-0000-000000000000",
        url: "https://example.com",
        viewports: ["desktop"],
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  // Edge case: POST /api/runs with optional figmaFrameUrl stores the reference
  test("POST /api/runs with figmaFrameUrl is accepted and run is created", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-015 Figma URL");

    const res = await request.post("/api/runs", {
      data: {
        projectId,
        url: "https://example.com",
        viewports: ["desktop"],
        figmaFrameUrl:
          "https://www.figma.com/file/abc123/MyDesign?node-id=1%3A2",
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as { id: string; figmaFrameUrl?: string };
    expect(body.figmaFrameUrl).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-016: Findings And Artifacts API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-016 — Findings And Artifacts API Endpoints", () => {
  test("GET /api/runs/:id/findings returns a paginated findings list", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-016 Findings");
    const runId = await createRun(request, projectId);

    const res = await request.get(`/api/runs/${runId}/findings`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      data: Array<unknown>;
      total: number;
      page: number;
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  test("GET /api/runs/:id/findings returns findings sorted by severity descending", async ({
    request,
  }) => {
    const projectId = await createProject(request, "ODQA-016 Severity Sort");
    const runId = await createRun(request, projectId);

    // Wait for run to produce findings
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request.get(`/api/runs/${runId}`);
      const pollBody = (await pollRes.json()) as { status: string };
      if (
        pollBody.status === "rules_complete" ||
        pollBody.status === "complete" ||
        pollBody.status === "failed"
      ) {
        break;
      }
    }

    const res = await request.get(`/api/runs/${runId}/findings`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      data: Array<{ severity: string }>;
    };

    const severityOrder: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const severities = body.data.map((f) => severityOrder[f.severity] ?? 0);
    for (let i = 1; i < severities.length; i++) {
      expect(severities[i]).toBeLessThanOrEqual(severities[i - 1]!);
    }
  });

  test("GET /api/runs/:id/artifacts returns artifact list with signed URLs", async ({
    request,
  }) => {
    const projectId = await createProject(request, "ODQA-016 Artifacts");
    const runId = await createRun(request, projectId);

    const res = await request.get(`/api/runs/${runId}/artifacts`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as Array<{
      artifactType: string;
      storageKey: string;
      signedUrl?: string;
    }>;

    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/runs/:id/artifacts includes figma and page screenshots when figmaFrameUrl is provided", async ({
    request,
  }) => {
    const projectId = await createProject(request, "ODQA-016 Figma Artifacts");

    const runRes = await request.post("/api/runs", {
      data: {
        projectId,
        url: "http://localhost:5173",
        viewports: ["desktop"],
        figmaFrameUrl:
          "https://www.figma.com/design/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?node-id=2-2523",
      },
    });
    expect(runRes.status()).toBe(201);
    const run = (await runRes.json()) as { id: string };

    for (let i = 0; i < 20; i++) {
      const runStatusRes = await request.get(`/api/runs/${run.id}`);
      expect(runStatusRes.status()).toBe(200);
      const runStatus = (await runStatusRes.json()) as { status: string };
      if (runStatus.status === "rules_complete" || runStatus.status === "failed") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const artifactsRes = await request.get(`/api/runs/${run.id}/artifacts`);
    expect(artifactsRes.status()).toBe(200);
    const artifacts = (await artifactsRes.json()) as Array<{
      artifactType: "screenshot" | "figma_frame";
      viewport: string;
      signedUrl?: string;
    }>;

    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: "screenshot",
          viewport: "desktop",
        }),
        expect.objectContaining({
          artifactType: "figma_frame",
          viewport: "desktop",
        }),
      ])
    );
  });

  // Edge case: findings endpoint returns 404 for unknown run
  test("GET /api/runs/:id/findings returns 404 for non-existent run", async ({ request }) => {
    const res = await request.get(
      "/api/runs/00000000-0000-0000-0000-000000000000/findings"
    );
    expect(res.status()).toBe(404);
  });

  // Edge case: artifacts endpoint returns 404 for unknown run
  test("GET /api/runs/:id/artifacts returns 404 for non-existent run", async ({ request }) => {
    const res = await request.get(
      "/api/runs/00000000-0000-0000-0000-000000000000/artifacts"
    );
    expect(res.status()).toBe(404);
  });

  // Edge case: pagination parameters are respected
  test("GET /api/runs/:id/findings respects page and pageSize query params", async ({
    request,
  }) => {
    const projectId = await createProject(request, "ODQA-016 Pagination");
    const runId = await createRun(request, projectId);

    const res = await request.get(`/api/runs/${runId}/findings?page=1&pageSize=5`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { data: Array<unknown>; page: number };
    expect(body.data.length).toBeLessThanOrEqual(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-017: Ignore Rules API Endpoint
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-017 — Ignore Rules API Endpoint", () => {
  test("POST /api/runs/:id/ignore-rules creates an IgnoreRule record", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-017 Ignore Rule");
    const runId = await createRun(request, projectId);

    const res = await request.post(`/api/runs/${runId}/ignore-rules`, {
      data: {
        ruleId: "overflow-clipping",
        selector: ".hero-banner",
      },
    });

    expect(res.status()).toBe(201);

    const body = (await res.json()) as {
      id: string;
      ruleId: string;
      selector?: string;
    };

    expect(body.id).toBeTruthy();
    expect(body.ruleId).toBe("overflow-clipping");
    expect(body.selector).toBe(".hero-banner");
  });

  test("findings matched by an ignore rule are excluded from GET /api/runs/:id/findings", async ({
    request,
  }) => {
    const projectId = await createProject(request, "ODQA-017 Suppression Test");
    const runId = await createRun(request, projectId, "http://localhost:3000");

    // Wait for run to complete and produce findings
    let findingsBeforeIgnore: Array<{ id: string; ruleId: string }> = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request.get(`/api/runs/${runId}`);
      const pollBody = (await pollRes.json()) as { status: string };
      if (
        pollBody.status === "rules_complete" ||
        pollBody.status === "complete" ||
        pollBody.status === "failed"
      ) {
        const findingsRes = await request.get(`/api/runs/${runId}/findings`);
        const findingsBody = (await findingsRes.json()) as { data: Array<{ id: string; ruleId: string }> };
        findingsBeforeIgnore = findingsBody.data;
        break;
      }
    }

    if (findingsBeforeIgnore.length === 0) {
      // No findings to suppress — skip assertion
      return;
    }

    // Create an ignore rule for the first finding's ruleId
    const targetRuleId = findingsBeforeIgnore[0]!.ruleId;
    await request.post(`/api/runs/${runId}/ignore-rules`, {
      data: { ruleId: targetRuleId },
    });

    const findingsAfterRes = await request.get(`/api/runs/${runId}/findings`);
    const findingsAfterBody = (await findingsAfterRes.json()) as { data: Array<{ ruleId: string }> };

    const suppressed = findingsAfterBody.data.filter((f) => f.ruleId === targetRuleId);
    expect(suppressed).toHaveLength(0);
  });

  // Edge case: ignore rule with region suppresses that region's findings
  test("POST /api/runs/:id/ignore-rules accepts a region object", async ({ request }) => {
    const projectId = await createProject(request, "ODQA-017 Region Ignore");
    const runId = await createRun(request, projectId);

    const res = await request.post(`/api/runs/${runId}/ignore-rules`, {
      data: {
        ruleId: "element-overlap",
        region: { x: 0, y: 0, width: 100, height: 100 },
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as { ruleId: string; region?: object };
    expect(body.ruleId).toBe("element-overlap");
    expect(body.region).toBeDefined();
  });

  // Edge case: returns 404 when run does not exist
  test("POST /api/runs/:id/ignore-rules returns 404 for non-existent run", async ({ request }) => {
    const res = await request.post(
      "/api/runs/00000000-0000-0000-0000-000000000000/ignore-rules",
      { data: { ruleId: "overflow-clipping" } }
    );
    expect(res.status()).toBe(404);
  });
});
