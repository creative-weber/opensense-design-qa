import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { ZodError, z } from "zod";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import { db } from "@opendesign-qa/db";
import { type AuditJobRequest, VIEWPORT_PRESETS } from "@opendesign-qa/contracts";
import { generateJsonReport, generateMarkdownReport } from "@opendesign-qa/reporting";

// ─── Environment ──────────────────────────────────────────────────────────────

const PORT = Number(process.env["API_PORT"] ?? 3001);
const HOST = process.env["API_HOST"] ?? "0.0.0.0";

// ─── Queue ────────────────────────────────────────────────────────────────────

export const AUDIT_QUEUE_NAME = "audit-jobs";

function getRedisConnection() {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    // Fail immediately when Redis is unreachable rather than queuing commands
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  };
}

export function createAuditQueue() {
  return new Queue<AuditJobRequest>(AUDIT_QUEUE_NAME, {
    connection: getRedisConnection(),
  });
}

// ─── In-memory stores (used until DB-backed endpoints are complete) ───────────

type Project = { id: string; name: string; createdAt: string };
type ViewportRun = { id: string; runId: string; viewport: string; status: string; errorCode?: string; attemptsMade?: number };
type AuditRun = {
  id: string;
  projectId: string;
  url: string;
  status: string;
  viewportRuns: ViewportRun[];
  figmaFrameUrl?: string;
  createdAt: string;
};
type Finding = {
  id: string;
  runId: string;
  ruleId: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  evidence: unknown[];
};
type CaptureArtifact = {
  id: string;
  runId: string;
  viewport: string;
  artifactType: "screenshot" | "figma_frame";
  storageKey: string;
  capturedAt: string;
  signedUrl: string;
  source?: "page_capture_stub" | "page_capture_live" | "direct_image_url" | "figma_api" | "fallback_placeholder";
};
type IgnoreRule = { id: string; runId: string; ruleId: string; selector?: string; region?: unknown };
type IgnoreRegion = { x: number; y: number; width: number; height: number };
type EvidenceRegion = { x: number; y: number; width: number; height: number };

function isIgnoreRegion(value: unknown): value is IgnoreRegion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const region = value as Partial<IgnoreRegion>;
  return (
    typeof region.x === "number" &&
    typeof region.y === "number" &&
    typeof region.width === "number" &&
    typeof region.height === "number"
  );
}

function getDomSelectorFromEvidence(evidence: unknown): string | undefined {
  if (typeof evidence !== "object" || evidence === null) {
    return undefined;
  }
  const selector = (evidence as { domSelector?: unknown }).domSelector;
  return typeof selector === "string" ? selector : undefined;
}

function getScreenshotRegionFromEvidence(
  evidence: unknown
): EvidenceRegion | undefined {
  if (typeof evidence !== "object" || evidence === null) {
    return undefined;
  }

  const screenshotRegion = (evidence as { screenshotRegion?: unknown })
    .screenshotRegion;
  if (!isIgnoreRegion(screenshotRegion)) {
    return undefined;
  }
  return screenshotRegion;
}

function regionsOverlap(a: EvidenceRegion, b: IgnoreRegion): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function isFindingIgnored(finding: Finding, rules: IgnoreRule[]): boolean {
  if (rules.some((rule) => rule.ruleId && rule.ruleId === finding.ruleId)) {
    return true;
  }

  if (
    rules.some(
      (rule) =>
        rule.selector &&
        finding.evidence.some(
          (evidence) => getDomSelectorFromEvidence(evidence) === rule.selector
        )
    )
  ) {
    return true;
  }

  return rules.some((rule) => {
    const region = rule.region;
    if (!isIgnoreRegion(region)) {
      return false;
    }
    return finding.evidence.some((evidence) => {
      const screenshotRegion = getScreenshotRegionFromEvidence(evidence);
      if (!screenshotRegion) {
        return false;
      }
      return regionsOverlap(screenshotRegion, region);
    });
  });
}

function getSeverityWeight(severity: Finding["severity"]): number {
  const order = { high: 3, medium: 2, low: 1 } as Record<string, number>;
  return order[severity] ?? 0;
}

function getFindingEvidenceLinks(finding: Finding): string[] {
  const links: string[] = [];
  for (const evidence of finding.evidence) {
    if (
      typeof evidence === "object" &&
      evidence !== null &&
      "screenshotUrl" in evidence &&
      typeof (evidence as { screenshotUrl?: unknown }).screenshotUrl === "string"
    ) {
      links.push((evidence as { screenshotUrl: string }).screenshotUrl);
    }
  }
  return links;
}

// ─── Build application ────────────────────────────────────────────────────────

type AuditQueueLike = Pick<Queue<AuditJobRequest>, "add" | "close">;

export function buildApp(options?: { auditQueue?: AuditQueueLike | null }) {
  const auditQueue: AuditQueueLike | null =
    options?.auditQueue !== undefined ? options.auditQueue : createAuditQueue();

  const projects = new Map<string, Project>();
  const runs = new Map<string, AuditRun>();
  const findings = new Map<string, Finding[]>();
  const artifacts = new Map<string, CaptureArtifact[]>();
  const ignoreRules = new Map<string, IgnoreRule[]>();

  const app = Fastify({
    logger:
      process.env["NODE_ENV"] !== "test"
        ? {
            transport:
              process.env["NODE_ENV"] !== "production"
                ? { target: "pino-pretty" }
                : undefined,
          }
        : false,
  });

  // ── Plugins ────────────────────────────────────────────────────────────────
  void app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? true,
  });
  void app.register(helmet);

  app.addHook("onClose", async () => {
    if (auditQueue) {
      await auditQueue.close();
    }
  });

  // ── Zod validation error handler ───────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const normalizedError =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown error");
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? ((error as { statusCode: number }).statusCode ?? 500)
        : 500;

    app.log.error(error);
    return reply.status(statusCode).send({
      statusCode,
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });

  // ── Health endpoint ────────────────────────────────────────────────────────
  app.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok" });
  });

  // ── Projects ───────────────────────────────────────────────────────────────
  app.post("/api/projects", async (request, reply) => {
    const body = z.object({ name: z.string().min(1) }).parse(request.body);
    const project: Project = {
      id: crypto.randomUUID(),
      name: body.name,
      createdAt: new Date().toISOString(),
    };
    projects.set(project.id, project);

    // Persist to DB (best-effort — falls back gracefully if DB is unavailable)
    try {
      await db.project.create({ data: { id: project.id, name: body.name } });
    } catch {
      app.log.warn({ projectId: project.id }, "DB persist skipped for project creation");
    }

    return reply.status(201).send(project);
  });

  app.get("/api/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = projects.get(id);
    if (!project) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Project not found" });
    }
    return reply.send(project);
  });

  // ── Runs ───────────────────────────────────────────────────────────────────
  const ViewportEnum = z.enum(["desktop", "tablet", "mobile"]);

  app.post("/api/runs", async (request, reply) => {
    const body = z
      .object({
        projectId: z.string().uuid(),
        url: z.string().url(),
        viewports: z.array(ViewportEnum).min(1),
        figmaFrameUrl: z.string().url().optional(),
        captureConfig: z.object({ waitStrategies: z.array(z.unknown()).optional() }).optional(),
      })
      .parse(request.body);

    if (!projects.has(body.projectId)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Project not found" });
    }

    const runId = crypto.randomUUID();
    const viewportRuns: ViewportRun[] = body.viewports.map((viewport) => ({
      id: crypto.randomUUID(),
      runId,
      viewport,
      status: "queued",
    }));

    const run: AuditRun = {
      id: runId,
      projectId: body.projectId,
      url: body.url,
      status: "queued",
      viewportRuns,
      figmaFrameUrl: body.figmaFrameUrl,
      createdAt: new Date().toISOString(),
    };

    runs.set(runId, run);
    findings.set(runId, []);
    artifacts.set(runId, []);
    ignoreRules.set(runId, []);

    // Persist AuditRun + ViewportRuns to DB (best-effort)
    try {
      await db.auditRun.create({
        data: {
          id: runId,
          projectId: body.projectId,
          url: body.url,
          status: "queued",
          figmaFrameUrl: body.figmaFrameUrl ?? null,
          viewportRuns: {
            create: viewportRuns.map((vr) => {
              const preset = VIEWPORT_PRESETS[vr.viewport as keyof typeof VIEWPORT_PRESETS] ?? { width: 1440, height: 900 };
              return {
                id: vr.id,
                viewport: vr.viewport as "desktop" | "tablet" | "mobile",
                viewportWidth: preset.width,
                viewportHeight: preset.height,
                status: "queued" as const,
              };
            }),
          },
        },
      });
    } catch {
      app.log.warn({ runId }, "DB persist skipped for run creation");
    }

    // ── Enqueue audit job to BullMQ worker ─────────────────────────────────
    const jobData: AuditJobRequest = {
      runId,
      projectId: body.projectId,
      url: body.url,
      viewports: body.viewports,
      figmaFrameUrl: body.figmaFrameUrl ?? null,
      viewportRunIds: Object.fromEntries(viewportRuns.map((vr) => [vr.viewport, vr.id])),
    };

    if (auditQueue) {
      try {
        await auditQueue.add("audit", jobData);
        app.log.info({ runId, viewports: body.viewports }, "Audit job enqueued to BullMQ");
      } catch (error) {
        app.log.warn({ runId, error }, "Failed to enqueue audit job; run persisted as queued");
      }
    }

    return reply.status(201).send(run);
  });

  app.get("/api/runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Try DB first for live status; fall back to in-memory
    try {
      const dbRun = await db.auditRun.findUnique({
        where: { id },
        include: {
          viewportRuns: {
            select: { id: true, viewport: true, status: true, errorCode: true },
          },
        },
      });
      if (dbRun) {
        return reply.send({
          id: dbRun.id,
          projectId: dbRun.projectId,
          url: dbRun.url,
          status: dbRun.status,
          figmaFrameUrl: dbRun.figmaFrameUrl ?? undefined,
          createdAt: dbRun.createdAt.toISOString(),
          viewportRuns: dbRun.viewportRuns.map((vr) => ({
            id: vr.id,
            runId: id,
            viewport: vr.viewport,
            status: vr.status,
            errorCode: vr.errorCode ?? undefined,
          })),
        });
      }
    } catch {
      app.log.warn({ runId: id }, "DB read failed for run; serving from in-memory");
    }

    const run = runs.get(id);
    if (!run) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }
    return reply.send(run);
  });

  // ── Findings ───────────────────────────────────────────────────────────────
  app.get("/api/runs/:id/findings", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check run exists (DB or memory)
    const runExistsInMemory = runs.has(id);
    let runExistsInDb = false;
    try {
      const count = await db.auditRun.count({ where: { id } });
      runExistsInDb = count > 0;
    } catch {
      // ignore DB errors
    }
    if (!runExistsInMemory && !runExistsInDb) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    const query = request.query as { page?: string; pageSize?: string; viewport?: string };
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    const viewportFilter = query.viewport as string | undefined;

    // Read findings from DB
    try {
      const viewportWhere = viewportFilter
        ? { auditRunId: id, viewport: viewportFilter as "desktop" | "tablet" | "mobile" }
        : { auditRunId: id };
      const dbFindings = await db.finding.findMany({
        where: { viewportRun: viewportWhere },
        include: { evidence: true },
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      });

      if (dbFindings.length > 0 || runExistsInDb) {
        const activeIgnoreRules = ignoreRules.get(id) ?? [];

        const mapped: Finding[] = dbFindings.map((f) => ({
          id: f.id,
          runId: id,
          viewportRunId: f.viewportRunId,
          ruleId: f.ruleId,
          title: f.title,
          severity: f.severity as Finding["severity"],
          description: f.description,
          evidence: f.evidence.map((ev) => ({
            domSelector: ev.domSelector ?? undefined,
            computedValue: ev.computedValue ?? undefined,
            expectedValue: ev.expectedValue ?? undefined,
            additionalData: (ev.additionalData as Record<string, unknown> | null) ?? undefined,
            screenshotRegion:
              ev.screenshotRegionX != null &&
              ev.screenshotRegionY != null &&
              ev.screenshotRegionWidth != null &&
              ev.screenshotRegionHeight != null
                ? {
                    x: ev.screenshotRegionX,
                    y: ev.screenshotRegionY,
                    width: ev.screenshotRegionWidth,
                    height: ev.screenshotRegionHeight,
                  }
                : undefined,
          })),
        }));

        const findingsWithIgnore = mapped.map((finding) => ({
          ...finding,
          isIgnored: isFindingIgnored(finding, activeIgnoreRules),
        }));

        const active = findingsWithIgnore
          .filter((f) => !f.isIgnored)
          .sort((a, b) => {
            const order = { high: 3, medium: 2, low: 1 } as Record<string, number>;
            return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
          });

        const start = (page - 1) * pageSize;
        return reply.send({ data: active.slice(start, start + pageSize), total: active.length, page });
      }
    } catch {
      app.log.warn({ runId: id }, "DB read failed for findings; serving from in-memory");
    }

    // Fall back to in-memory
    const runFindings = findings.get(id) ?? [];
    const activeIgnoreRules = ignoreRules.get(id) ?? [];

    // Mark findings as isIgnored for audit traceability
    const findingsWithIgnore = runFindings.map((finding) => ({
      ...finding,
      isIgnored: isFindingIgnored(finding, activeIgnoreRules),
    }));

    // Only return non-ignored findings in the main list, but include isIgnored field
    const active = findingsWithIgnore
      .filter(f => !f.isIgnored)
      .sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 } as Record<string, number>;
        return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
      });

    const start = (page - 1) * pageSize;
    const data = active.slice(start, start + pageSize);

    return reply.send({ data, total: active.length, page });
  });

  // ── Artifacts ─────────────────────────────────────────────────────────────
  app.get("/api/runs/:id/artifacts", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!runs.has(id)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    // Prefer DB-persisted artifacts; fall back to in-memory if DB is unavailable
    try {
      const dbArtifacts = await db.captureArtifact.findMany({
        where: { viewportRun: { auditRunId: id } },
        include: { viewportRun: { select: { viewport: true } } },
        orderBy: { capturedAt: "asc" },
      });

      if (dbArtifacts.length > 0) {
        const memArtifacts = artifacts.get(id) ?? [];
        return reply.send(
          dbArtifacts.map((a) => {
            const memArtifact = memArtifacts.find((m) => m.id === a.id);
            const apiBaseUrl = (process.env["API_BASE_URL"] ?? "http://localhost:3001").replace(/\/$/, "");
            const webBaseUrl = (process.env["WEB_BASE_URL"] ?? "http://localhost:3000").replace(/\/$/, "");
            const signedUrl =
              memArtifact?.signedUrl ??
              (a.storageKey.includes("/live-capture.png")
                ? `${apiBaseUrl}/api/artifacts/${a.id}/image?runId=${id}&signature=test`
                : `${webBaseUrl}/${a.storageKey}?runId=${id}&signature=test`);
            return {
              id: a.id,
              runId: id,
              viewportRunId: a.viewportRunId,
              viewport: a.viewportRun.viewport,
              artifactType: a.artifactType,
              storageKey: a.storageKey,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              capturedAt: a.capturedAt.toISOString(),
              signedUrl,
              source: memArtifact?.source,
            };
          })
        );
      }
    } catch {
      app.log.warn({ runId: id }, "DB read failed for artifacts; serving from in-memory");
    }

    return reply.send(artifacts.get(id) ?? []);
  });

  // ── Run export ────────────────────────────────────────────────────────────
  app.get("/api/runs/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);
    if (!run) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    const query = request.query as { format?: string };
    const format = z.enum(["json", "markdown"]).parse(query.format ?? "json");

    const runFindings = findings.get(id) ?? [];
    const runArtifacts = artifacts.get(id) ?? [];

    const reportRun = {
      id: run.id,
      projectId: run.projectId,
      url: run.url,
      status: run.status,
      createdAt: run.createdAt,
    };

    // Cast: the in-memory Finding type is a subset of ReportFinding
    type LooseFinding = Parameters<typeof generateJsonReport>[1][number];
    const castedFindings = runFindings as unknown as LooseFinding[];

    if (format === "json") {
      const report = generateJsonReport(reportRun, castedFindings, runArtifacts);
      return reply.send(report);
    }

    const markdown = generateMarkdownReport(reportRun, castedFindings, runArtifacts);
    reply.header("content-type", "text/markdown; charset=utf-8");
    return reply.send(markdown);
  });

  // ── Ignore rules ──────────────────────────────────────────────────────────
  app.post("/api/runs/:id/ignore-rules", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!runs.has(id)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    const body = z
      .object({
        ruleId: z.string().min(1),
        selector: z.string().optional(),
        region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
      })
      .parse(request.body);

    const rule: IgnoreRule = { id: crypto.randomUUID(), runId: id, ...body };
    ignoreRules.get(id)!.push(rule);

    return reply.status(201).send(rule);
  });

  return app;
}

// ─── Start server (only when run directly) ────────────────────────────────────

const isExecutedDirectly = (() => {
  const executedPath = process.argv[1];
  if (!executedPath) {
    return false;
  }

  return fileURLToPath(import.meta.url) === executedPath;
})();

if (process.env["NODE_ENV"] !== "test" && (isExecutedDirectly || process.env["ODQA_START_SERVER"] === "1")) {
  const auditQueue = createAuditQueue();
  const app = buildApp({ auditQueue });
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    app.log.info({ address, port: PORT, host: HOST }, "OpenDesign QA API listening");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
