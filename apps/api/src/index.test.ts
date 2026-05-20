import { describe, it, expect, vi } from "vitest";
import { buildApp } from "./index.js";

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
  return response.json() as { id: string; status: string };
}

async function waitForRunStatus(
  app: ReturnType<typeof buildApp>,
  runId: string,
  terminalStatuses: string[]
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}`,
    });
    const body = response.json() as {
      status: string;
      viewportRuns: Array<{ status: string; errorCode?: string; attemptsMade?: number }>;
    };

    if (terminalStatuses.includes(body.status)) {
      return body;
    }
  }

  throw new Error(`Run ${runId} did not reach a terminal state in time`);
}

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("Zod error handler", () => {
  it("returns 400 with structured issues when a route throws ZodError", async () => {
    const { ZodError, z } = await import("zod");
    const app = buildApp();

    app.get("/test-zod-error", async () => {
      z.object({ name: z.string() }).parse({ name: 123 });
    });

    const response = await app.inject({
      method: "GET",
      url: "/test-zod-error",
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { issues: { path: string; message: string }[] };
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0]).toHaveProperty("path");
    expect(body.issues[0]).toHaveProperty("message");
  });
});

describe("audit lifecycle", () => {
  it("completes fixture audits with findings and screenshot artifacts", async () => {
    const app = buildApp();
    const projectId = await createProject(app, "Fixture Audit");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000/fixtures/overflow",
      viewports: ["desktop"],
    });

    expect(run.status).toBe("queued");

    const finalRun = await waitForRunStatus(app, run.id, ["rules_complete"]);
    expect(finalRun.status).toBe("rules_complete");
    expect(finalRun.viewportRuns[0]?.status).toBe("rules_complete");

    const findingsResponse = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/findings`,
    });
    const findings = findingsResponse.json() as {
      data: Array<{ ruleId: string; severity: string }>;
    };
    expect(findings.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "overflow-clipping", severity: "high" }),
      ])
    );

    const artifactsResponse = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/artifacts`,
    });
    const artifacts = artifactsResponse.json() as Array<{
      storageKey: string;
      viewport: string;
      signedUrl: string;
    }>;
    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          viewport: "desktop",
          signedUrl: expect.stringContaining("signature=test"),
        }),
      ])
    );
    expect(artifacts[0]?.storageKey).toContain(run.id);

    await app.close();
  });

  it("marks unreachable targets failed with retries and no artifacts", async () => {
    const app = buildApp();
    const projectId = await createProject(app, "Failed Audit");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:19999/no-page-here",
      viewports: ["desktop"],
    });

    const finalRun = await waitForRunStatus(app, run.id, ["failed"]);
    expect(finalRun.status).toBe("failed");
    expect(finalRun.viewportRuns[0]?.status).toBe("failed");
    expect(finalRun.viewportRuns[0]?.errorCode).toBe("NON_200_RESPONSE");
    expect(finalRun.viewportRuns[0]?.attemptsMade).toBe(3);

    const artifactsResponse = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/artifacts`,
    });
    expect(artifactsResponse.json()).toEqual([]);

    await app.close();
  });

  it("returns figma comparison findings for dashboard audits", async () => {
    const app = buildApp();
    const projectId = await createProject(app, "Figma Dashboard Audit");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:5173",
      viewports: ["desktop"],
      figmaFrameUrl:
        "https://www.figma.com/design/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?node-id=2-2523",
    });

    await waitForRunStatus(app, run.id, ["rules_complete"]);

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/findings`,
    });
    const body = response.json() as {
      data: Array<{ ruleId: string; severity: string }>;
    };

    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "figma-comparison-layout-drift",
          severity: "high",
        }),
        expect.objectContaining({
          ruleId: "figma-comparison-visual-style",
          severity: "medium",
        }),
      ])
    );

    await app.close();
  });

  it("creates figma frame artifacts when figmaFrameUrl is provided", async () => {
    const app = buildApp();
    const projectId = await createProject(app, "Figma Artifacts Audit");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:5173",
      viewports: ["desktop", "mobile"],
      figmaFrameUrl:
        "https://www.figma.com/design/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?node-id=2-2523",
    });

    await waitForRunStatus(app, run.id, ["rules_complete"]);

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/artifacts`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{
      artifactType: "screenshot" | "figma_frame";
      viewport: string;
      signedUrl: string;
      storageKey: string;
      source?: string;
    }>;

    const screenshots = body.filter((artifact) => artifact.artifactType === "screenshot");
    const figmaFrames = body.filter((artifact) => artifact.artifactType === "figma_frame");

    expect(screenshots).toHaveLength(2);
    expect(figmaFrames).toHaveLength(2);
    expect(figmaFrames[0]?.source).toBeDefined();
    expect(figmaFrames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          viewport: "desktop",
          signedUrl: expect.stringContaining("figma-frame-screenshot.svg"),
          source: "fallback_placeholder",
        }),
        expect.objectContaining({
          viewport: "mobile",
          signedUrl: expect.stringContaining("figma-frame-screenshot.svg"),
          source: "fallback_placeholder",
        }),
      ])
    );

    await app.close();
  });

  it("resolves figma design links through Figma Images API when token is configured", async () => {
    const previousToken = process.env["FIGMA_ACCESS_TOKEN"];
    process.env["FIGMA_ACCESS_TOKEN"] = "test-figma-token";

    const figmaExportUrl = "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/frame-2-2523.png";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: {
          "2:2523": figmaExportUrl,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const app = buildApp();

    try {
      const projectId = await createProject(app, "Figma API Resolution Audit");
      const run = await createRun(app, {
        projectId,
        url: "http://localhost:5173",
        viewports: ["desktop"],
        figmaFrameUrl:
          "https://www.figma.com/design/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?node-id=2-2523",
      });

      await waitForRunStatus(app, run.id, ["rules_complete"]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(String(call?.[0])).toContain(
        "https://api.figma.com/v1/images/qV55cgBXcAXWsmdHhir6Nm"
      );

      const artifactsResponse = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/artifacts`,
      });

      const artifacts = artifactsResponse.json() as Array<{
        artifactType: "screenshot" | "figma_frame";
        signedUrl: string;
        source?: string;
      }>;

      const figmaArtifact = artifacts.find((artifact) => artifact.artifactType === "figma_frame");
      expect(figmaArtifact?.signedUrl).toBe(figmaExportUrl);
      expect(figmaArtifact?.source).toBe("figma_api");
    } finally {
      await app.close();
      vi.unstubAllGlobals();
      if (typeof previousToken === "string") {
        process.env["FIGMA_ACCESS_TOKEN"] = previousToken;
      } else {
        delete process.env["FIGMA_ACCESS_TOKEN"];
      }
    }
  });

  it("supports proto links with node-id in hash when resolving figma exports", async () => {
    const previousToken = process.env["FIGMA_ACCESS_TOKEN"];
    process.env["FIGMA_ACCESS_TOKEN"] = "test-figma-token";

    const figmaExportUrl = "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/frame-proto.png";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: {
          "2:2522": figmaExportUrl,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const app = buildApp();

    try {
      const projectId = await createProject(app, "Figma Proto Link Audit");
      const run = await createRun(app, {
        projectId,
        url: "http://localhost:5173",
        viewports: ["desktop"],
        figmaFrameUrl:
          "https://www.figma.com/proto/qV55cgBXcAXWsmdHhir6Nm/Analytics-Dashboard--Community-?page-id=0%3A1#node-id=2-2522",
      });

      await waitForRunStatus(app, run.id, ["rules_complete"]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(String(call?.[0])).toContain("ids=2%3A2522");

      const artifactsResponse = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}/artifacts`,
      });
      const artifacts = artifactsResponse.json() as Array<{
        artifactType: "screenshot" | "figma_frame";
        signedUrl: string;
        source?: string;
      }>;
      const figmaArtifact = artifacts.find((artifact) => artifact.artifactType === "figma_frame");
      expect(figmaArtifact?.signedUrl).toBe(figmaExportUrl);
      expect(figmaArtifact?.source).toBe("figma_api");
    } finally {
      await app.close();
      vi.unstubAllGlobals();
      if (typeof previousToken === "string") {
        process.env["FIGMA_ACCESS_TOKEN"] = previousToken;
      } else {
        delete process.env["FIGMA_ACCESS_TOKEN"];
      }
    }
  });

  it("exports run report as json with summary and top findings", async () => {
    const app = buildApp();
    const projectId = await createProject(app, "Export JSON Audit");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000/fixtures/overflow",
      viewports: ["desktop"],
    });

    await waitForRunStatus(app, run.id, ["rules_complete"]);

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${run.id}/export?format=json`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      run: { id: string; status: string };
      summary: { totalFindings: number; high: number; medium: number; low: number };
      topBlockingFindings: Array<{ ruleId: string }>;
    };
    expect(body.run.id).toBe(run.id);
    expect(body.summary.totalFindings).toBeGreaterThan(0);
    expect(body.topBlockingFindings[0]?.ruleId).toBe("overflow-clipping");

    await app.close();
  });

  it("exports run report as markdown", async () => {
    const app = buildApp();
    const projectId = await createProject(app, "Export Markdown Audit");
    const run = await createRun(app, {
      projectId,
      url: "http://localhost:3000/fixtures/overflow",
      viewports: ["desktop"],
    });

    await waitForRunStatus(app, run.id, ["rules_complete"]);

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
