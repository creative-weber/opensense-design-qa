import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp, AUDIT_QUEUE_NAME } from "./index.js";

// ─── Mock BullMQ so tests do not need a live Redis ───────────────────────────

vi.mock("bullmq", () => {
  const addFn = vi.fn().mockResolvedValue({ id: "job-1" });
  const closeFn = vi.fn().mockResolvedValue(undefined);
  return {
    Queue: vi.fn().mockImplementation(() => ({ add: addFn, close: closeFn })),
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

async function createProject(app: ReturnType<typeof buildApp>, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: { name },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { id: string }).id;
}

async function createRun(
  app: ReturnType<typeof buildApp>,
  payload: { projectId: string; url: string; viewports: string[]; figmaFrameUrl?: string }
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/runs",
    payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json() as {
    id: string;
    status: string;
    viewportRuns: Array<{ id: string; viewport: string; status: string }>;
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = buildApp({ auditQueue: null });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});

describe("Zod error handler", () => {
  it("returns 400 with structured issues when a route throws ZodError", async () => {
    const { ZodError, z } = await import("zod");
    const app = buildApp({ auditQueue: null });

    app.get("/test-zod-error", async () => {
      z.object({ name: z.string() }).parse({ name: 123 });
    });

    const response = await app.inject({ method: "GET", url: "/test-zod-error" });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { issues: { path: string; message: string }[] };
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0]).toHaveProperty("path");
    expect(body.issues[0]).toHaveProperty("message");
    await app.close();
  });
});

describe("AUDIT_QUEUE_NAME", () => {
  it("equals audit-jobs (matches worker constant)", () => {
    expect(AUDIT_QUEUE_NAME).toBe("audit-jobs");
  });
});

describe("POST /api/runs — BullMQ enqueueing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a run with queued status and enqueues a BullMQ job", async () => {
    const mockQueue = makeMockQueue();
    const app = buildApp({ auditQueue: mockQueue });

    const projectId = await createProject(app, "Queue Test Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000/fixtures/overflow",
      viewports: ["desktop", "mobile"],
    });

    expect(run.status).toBe("queued");
    expect(run.viewportRuns).toHaveLength(2);
    expect(run.viewportRuns.every((vr) => vr.status === "queued")).toBe(true);

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData] = mockQueue.add.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(jobName).toBe("audit");
    expect(jobData["runId"]).toBe(run.id);
    expect(jobData["projectId"]).toBe(projectId);
    expect(jobData["url"]).toBe("http://localhost:3000/fixtures/overflow");
    expect(jobData["viewports"]).toEqual(["desktop", "mobile"]);
    expect(jobData["viewportRunIds"]).toBeDefined();

    await app.close();
  });

  it("includes figmaFrameUrl in the enqueued job when provided", async () => {
    const mockQueue = makeMockQueue();
    const app = buildApp({ auditQueue: mockQueue });

    const projectId = await createProject(app, "Figma Queue Project");
    const figmaFrameUrl =
      "https://www.figma.com/design/abc123/Frame?node-id=1-1";
    await createRun(app, {
      projectId,
      url: "http://localhost:5173",
      viewports: ["desktop"],
      figmaFrameUrl,
    });

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    const [, jobData] = mockQueue.add.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(jobData["figmaFrameUrl"]).toBe(figmaFrameUrl);

    await app.close();
  });

  it("maps each viewport to its viewportRun ID in the enqueued job", async () => {
    const mockQueue = makeMockQueue();
    const app = buildApp({ auditQueue: mockQueue });

    const projectId = await createProject(app, "Viewport IDs Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop", "tablet", "mobile"],
    });

    const [, jobData] = mockQueue.add.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    const viewportRunIds = jobData["viewportRunIds"] as Record<string, string>;
    expect(Object.keys(viewportRunIds)).toEqual(
      expect.arrayContaining(["desktop", "tablet", "mobile"])
    );
    for (const vr of run.viewportRuns) {
      expect(viewportRunIds[vr.viewport]).toBe(vr.id);
    }

    await app.close();
  });

  it("still returns 201 with queued run if queue.add throws", async () => {
    const failQueue = {
      add: vi.fn().mockRejectedValue(new Error("Redis down")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildApp({ auditQueue: failQueue });

    const projectId = await createProject(app, "Queue Failure Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop"],
    });

    expect(run.status).toBe("queued");
    await app.close();
  });

  it("returns 404 when projectId does not exist", async () => {
    const app = buildApp({ auditQueue: null });
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: {
        projectId: "00000000-0000-0000-0000-000000000000",
        url: "http://localhost:3000",
        viewports: ["desktop"],
      },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("does not call queue.add when auditQueue is null", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "No Queue Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop"],
    });
    expect(run.status).toBe("queued");
    await app.close();
  });
});

describe("GET /api/runs/:id", () => {
  it("returns the run with queued status", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "Get Run Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { status: string }).status).toBe("queued");
    await app.close();
  });

  it("returns 404 for unknown run", async () => {
    const app = buildApp({ auditQueue: null });
    const response = await app.inject({
      method: "GET",
      url: "/api/runs/00000000-0000-0000-0000-000000000000",
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /api/runs/:id/findings", () => {
  it("returns empty findings for a newly queued run (worker not yet processed)", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "Findings Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000/fixtures/overflow",
      viewports: ["desktop"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/findings`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; total: number };
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);

    await app.close();
  });

  it("returns 404 for unknown run", async () => {
    const app = buildApp({ auditQueue: null });
    const response = await app.inject({
      method: "GET",
      url: "/api/runs/00000000-0000-0000-0000-000000000000/findings",
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /api/runs/:id/artifacts", () => {
  it("returns empty artifacts for a newly queued run (worker not yet processed)", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "Artifacts Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/artifacts`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);

    await app.close();
  });

  it("returns 404 for unknown run", async () => {
    const app = buildApp({ auditQueue: null });
    const response = await app.inject({
      method: "GET",
      url: "/api/runs/00000000-0000-0000-0000-000000000000/artifacts",
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /api/runs/:id/export", () => {
  it("returns json export with empty findings summary for a queued run", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "Export JSON Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000/fixtures/overflow",
      viewports: ["desktop"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/export?format=json`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      run: { id: string; status: string };
      summary: { totalFindings: number; high: number; medium: number; low: number };
      topBlockingFindings: unknown[];
    };
    expect(body.run.id).toBe(run.id);
    expect(body.run.status).toBe("queued");
    expect(body.summary.totalFindings).toBe(0);
    expect(body.topBlockingFindings).toEqual([]);

    await app.close();
  });

  it("returns markdown export for a queued run", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "Export Markdown Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop"],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/export?format=markdown`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/markdown");
    expect(response.body).toContain("# Run Export:");
    expect(response.body).toContain("## Severity Summary");

    await app.close();
  });
});

describe("POST /api/runs/:id/ignore-rules", () => {
  it("creates an ignore rule for an existing run", async () => {
    const app = buildApp({ auditQueue: null });
    const projectId = await createProject(app, "Ignore Rules Project");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000",
      viewports: ["desktop"],
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/runs/${run.id}/ignore-rules`,
      payload: { ruleId: "overflow-clipping" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string; ruleId: string; runId: string };
    expect(body.ruleId).toBe("overflow-clipping");
    expect(body.runId).toBe(run.id);

    await app.close();
  });

  it("returns 404 for unknown run", async () => {
    const app = buildApp({ auditQueue: null });
    const response = await app.inject({
      method: "POST",
      url: "/api/runs/00000000-0000-0000-0000-000000000000/ignore-rules",
      payload: { ruleId: "overflow-clipping" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
