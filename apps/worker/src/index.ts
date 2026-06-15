import { Worker, type Job } from "bullmq";
import pino from "pino";
import { AuditJobSchema, type AuditJobRequest } from "@opendesign-qa/contracts";
import { capture, type CaptureResult, type AccessibilityViolation } from "@opendesign-qa/capture";
import { diff, clusterRegions, type DiffRegion } from "@opendesign-qa/compare";
import { runRules } from "@opendesign-qa/rules-core";
import { ALL_RULES } from "@opendesign-qa/rules-web";
import { getStorage, type StorageAdapter } from "@opendesign-qa/storage";
import { db } from "@opendesign-qa/db";
import { parseFigmaFrameReference, isParseError } from "@opendesign-qa/figma";
import { notifySlack } from "./notify-slack.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const AUDIT_QUEUE_NAME = "audit-jobs";

// ─── Logger ───────────────────────────────────────────────────────────────────

export const logger = pino(
  process.env["NODE_ENV"] === "test"
    ? { level: "silent" }
    : {
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty" }
            : undefined,
      }
);

export type ProcessedAuditJob = AuditJobRequest;

type ViewportExecutionSummary = {
  viewport: string;
  findingsCount: number;
  storageKey?: string;
  signedUrl?: string;
  failed?: boolean;
};

function tryGetStorage(): StorageAdapter | undefined {
  try {
    return getStorage();
  } catch (error) {
    logger.warn(
      { error },
      "Storage is not configured, continuing without artifact upload"
    );
    return undefined;
  }
}

async function uploadCaptureArtifact(
  storage: StorageAdapter | undefined,
  runId: string,
  viewport: string,
  captureResult: CaptureResult
): Promise<{ storageKey?: string; signedUrl?: string }> {
  if (!storage) {
    return {};
  }

  const storageKey = `runs/${runId}/${viewport}/screenshot-${Date.now()}.png`;
  try {
    await storage.upload(storageKey, captureResult.screenshotBuffer, "image/png");
    const signedUrl = await storage.getSignedUrl(storageKey);
    return { storageKey, signedUrl };
  } catch (error) {
    logger.warn({ error, runId, viewport }, "Storage upload failed; continuing without artifact");
    return {};
  }
}

// ─── Persist CaptureArtifact to DB ───────────────────────────────────────────

async function persistCaptureArtifact(
  viewportRunId: string | undefined,
  storageKey: string,
  capturedAt: Date
): Promise<void> {
  if (!viewportRunId) {
    return;
  }
  try {
    await db.captureArtifact.create({
      data: {
        viewportRunId,
        artifactType: "screenshot",
        storageKey,
        mimeType: "image/png",
        capturedAt,
      },
    });
  } catch (error) {
    logger.warn({ error, viewportRunId, storageKey }, "Failed to persist CaptureArtifact to DB; continuing");
  }
}

// ─── Redis connection options ─────────────────────────────────────────────────

function getRedisConnection() {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function updateViewportRunStatus(
  viewportRunId: string | undefined,
  status: "capturing" | "running_rules" | "rules_complete" | "complete" | "failed",
  extra?: { errorCode?: string; errorMessage?: string }
): Promise<void> {
  if (!viewportRunId) return;
  try {
    await db.viewportRun.update({
      where: { id: viewportRunId },
      data: {
        status,
        ...(status === "complete" || status === "failed" ? { completedAt: new Date() } : {}),
        ...(extra?.errorCode ? { errorCode: extra.errorCode } : {}),
        ...(extra?.errorMessage ? { errorMessage: extra.errorMessage } : {}),
      },
    });
  } catch (error) {
    logger.warn({ error, viewportRunId, status }, "Failed to update ViewportRun status in DB; continuing");
  }
}

async function updateAuditRunStatus(
  runId: string,
  status: "capturing" | "running_rules" | "rules_complete" | "complete" | "failed",
  extra?: { errorCode?: string; errorMessage?: string }
): Promise<void> {
  try {
    await db.auditRun.update({
      where: { id: runId },
      data: {
        status,
        ...(status === "complete" || status === "failed" ? { completedAt: new Date() } : {}),
        ...(extra?.errorCode ? { errorCode: extra.errorCode } : {}),
        ...(extra?.errorMessage ? { errorMessage: extra.errorMessage } : {}),
      },
    });
  } catch (error) {
    logger.warn({ error, runId, status }, "Failed to update AuditRun status in DB; continuing");
  }
}

async function persistFindings(
  viewportRunId: string | undefined,
  ruleResults: ReturnType<typeof runRules>
): Promise<void> {
  if (!viewportRunId || ruleResults.length === 0) return;
  try {
    await db.$transaction(
      ruleResults.map((result) =>
        db.finding.create({
          data: {
            viewportRunId,
            ruleId: result.ruleId,
            findingType: result.ruleId,
            title: result.title,
            description: result.description,
            severity: result.severity as "high" | "medium" | "low",
            confidence: result.confidence,
            evidence: {
              create: result.evidence.map((ev) => ({
                domSelector: ev.domSelector ?? null,
                computedValue: ev.computedValue ?? null,
                expectedValue: ev.expectedValue ?? null,
                screenshotRegionX: ev.screenshotRegion?.x ?? null,
                screenshotRegionY: ev.screenshotRegion?.y ?? null,
                screenshotRegionWidth: ev.screenshotRegion?.width ?? null,
                screenshotRegionHeight: ev.screenshotRegion?.height ?? null,
                additionalData: ev.suggestedFix ? { suggestedFix: ev.suggestedFix } : null,
              })),
            },
          },
        })
      )
    );
    logger.info({ viewportRunId, count: ruleResults.length }, "Persisted findings to DB");
  } catch (error) {
    logger.warn({ error, viewportRunId }, "Failed to persist findings to DB; continuing");
  }
}

// ─── Accessibility findings persistence ──────────────────────────────────────

function accessibilityImpactToSeverity(
  impact: AccessibilityViolation["impact"]
): "critical" | "high" | "medium" | "low" | "info" {
  switch (impact) {
    case "critical": return "critical";
    case "serious": return "high";
    case "moderate": return "medium";
    case "minor": return "low";
    default: return "info";
  }
}

async function persistAccessibilityFindings(
  viewportRunId: string | undefined,
  violations: AccessibilityViolation[]
): Promise<void> {
  if (!viewportRunId || violations.length === 0) return;
  try {
    await db.$transaction(
      violations.map((violation) =>
        db.finding.create({
          data: {
            viewportRunId,
            ruleId: `accessibility/${violation.id}`,
            findingType: "accessibility",
            title: violation.help,
            description: `${violation.description} — ${violation.wcagTags.join(", ")}`,
            severity: accessibilityImpactToSeverity(violation.impact),
            confidence: 0.95,
            evidence: {
              create: violation.nodes.slice(0, 10).map((node) => ({
                domSelector: node.target[0] ?? null,
                computedValue: node.html.slice(0, 500),
                expectedValue: violation.help,
                additionalData: {
                  wcagTags: violation.wcagTags,
                  helpUrl: violation.helpUrl,
                  impact: violation.impact,
                  failureSummary: node.failureSummary ?? null,
                  suggestedFix: node.failureSummary ?? `Fix: ${violation.help}. See ${violation.helpUrl}`,
                },
              })),
            },
          },
        })
      )
    );
    logger.info({ viewportRunId, count: violations.length }, "Persisted accessibility findings to DB");
  } catch (error) {
    logger.warn({ error, viewportRunId }, "Failed to persist accessibility findings to DB; continuing");
  }
}

// ─── Comparison helpers ─────────────────────────────────────────────────────

type RegionFinding = {
  ruleId: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
};

function regionToFinding(region: DiffRegion): RegionFinding {
  switch (region.type) {
    case "missing":
      return {
        ruleId: "figma-diff/missing",
        title: "Missing Element",
        description: `A design element present in the Figma frame is absent in the live page (${region.mismatchPixels} px affected).`,
        severity: "high",
      };
    case "misaligned":
      return {
        ruleId: "figma-diff/misaligned",
        title: "Misaligned Element",
        description: `An element appears at a different position compared to the Figma design (${region.mismatchPixels} px affected).`,
        severity: "medium",
      };
    case "restyled":
      return {
        ruleId: "figma-diff/restyled",
        title: "Visual Restyling",
        description: `An element has a different visual style compared to the Figma design (${region.mismatchPixels} px affected).`,
        severity: "low",
      };
  }
}

export async function generateComparisonFindings(
  viewportRunId: string | undefined,
  figmaBuffer: Buffer,
  screenshotBuffer: Buffer,
  storage: StorageAdapter | undefined,
  runId: string,
  viewport: string
): Promise<void> {
  if (!viewportRunId) return;
  try {
    const diffResult = await diff(figmaBuffer, screenshotBuffer);

    // Upload diff image as a diff_image artifact
    if (storage) {
      const diffKey = `runs/${runId}/${viewport}/diff-${Date.now()}.png`;
      try {
        await storage.upload(diffKey, diffResult.diffBuffer, "image/png");
        await db.captureArtifact.create({
          data: {
            viewportRunId,
            artifactType: "diff_image",
            storageKey: diffKey,
            mimeType: "image/png",
            capturedAt: new Date(),
          },
        });
      } catch (uploadErr) {
        logger.warn({ uploadErr, runId, viewport }, "Diff image upload failed; continuing");
      }
    }

    if (diffResult.mismatchRatio === 0) {
      logger.info({ viewportRunId }, "No visual mismatch detected in Figma comparison");
      return;
    }

    const regions = await clusterRegions(figmaBuffer, screenshotBuffer, diffResult);

    if (regions.length === 0) {
      logger.info({ viewportRunId }, "No significant mismatch regions found after clustering");
      return;
    }

    await db.$transaction(
      regions.map((region) => {
        const { ruleId, title, description, severity } = regionToFinding(region);
        const confidence = Math.min(1, region.mismatchPixels / region.area);
        return db.finding.create({
          data: {
            viewportRunId,
            ruleId,
            findingType: ruleId,
            title,
            description,
            severity,
            confidence,
            evidence: {
              create: [
                {
                  screenshotRegionX: region.x,
                  screenshotRegionY: region.y,
                  screenshotRegionWidth: region.width,
                  screenshotRegionHeight: region.height,
                  computedValue: String(region.mismatchPixels),
                  additionalData: {
                    type: region.type,
                    area: region.area,
                    mismatchPixels: region.mismatchPixels,
                    overallMismatchRatio: diffResult.mismatchRatio,
                  },
                },
              ],
            },
          },
        });
      })
    );

    logger.info(
      { viewportRunId, count: regions.length, mismatchRatio: diffResult.mismatchRatio },
      "Persisted comparison findings to DB"
    );
  } catch (error) {
    logger.warn({ error, viewportRunId }, "Comparison findings generation failed; continuing");
  }
}

// ─── Figma helpers ────────────────────────────────────────────────────────────

async function fetchFigmaImageBuffer(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<Buffer> {
  const encodedNodeId = encodeURIComponent(nodeId);
  const imagesUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodedNodeId}&scale=2&format=png`;
  const imagesRes = await fetch(imagesUrl, {
    headers: { "X-Figma-Token": token },
  });
  if (!imagesRes.ok) {
    throw new Error(`Figma images API returned ${imagesRes.status}: ${await imagesRes.text()}`);
  }
  const imagesJson = (await imagesRes.json()) as { images?: Record<string, string | null>; err?: string };
  if (imagesJson.err) throw new Error(`Figma images API error: ${imagesJson.err}`);
  const imageUrl = imagesJson.images?.[nodeId] ?? imagesJson.images?.[encodedNodeId];
  if (!imageUrl) throw new Error(`No image URL returned for node ${nodeId}`);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download Figma image: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function fetchFigmaNodeMetadata(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<unknown> {
  const encodedNodeId = encodeURIComponent(nodeId);
  const metaUrl = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodedNodeId}`;
  const metaRes = await fetch(metaUrl, {
    headers: { "X-Figma-Token": token },
  });
  if (!metaRes.ok) {
    throw new Error(`Figma nodes API returned ${metaRes.status}: ${await metaRes.text()}`);
  }
  return metaRes.json();
}

async function processFigmaReference(
  runId: string,
  figmaFrameUrl: string,
  storage: StorageAdapter | undefined
): Promise<Buffer | undefined> {
  const parseResult = parseFigmaFrameReference(figmaFrameUrl);
  if (isParseError(parseResult)) {
    logger.warn({ runId, figmaFrameUrl, reason: parseResult.message }, "Could not parse Figma frame URL; skipping");
    return undefined;
  }
  const ref = parseResult;
  const { fileKey, nodeId } = ref;

  // Create FigmaReference row with status=fetching
  let figmaRefId: string;
  try {
    const created = await db.figmaReference.create({
      data: {
        auditRunId: runId,
        figmaFileKey: fileKey,
        figmaNodeId: nodeId,
        status: "fetching",
      },
    });
    figmaRefId = created.id;
  } catch (error) {
    logger.warn({ error, runId }, "Failed to create FigmaReference row; skipping");
    return;
  }

  const token = process.env["FIGMA_ACCESS_TOKEN"] ?? "";
  if (!token) {
    logger.warn({ runId }, "FIGMA_ACCESS_TOKEN not set; marking FigmaReference as failed");
    await db.figmaReference.update({
      where: { id: figmaRefId },
      data: { status: "failed" },
    });
    return undefined;
  }

  try {
    // Fetch frame image and node metadata in parallel
    const [imageBuffer, metadataJson] = await Promise.all([
      fetchFigmaImageBuffer(fileKey, nodeId, token),
      fetchFigmaNodeMetadata(fileKey, nodeId, token),
    ]);

    // Upload image to storage
    let storageKey: string | undefined;
    if (storage) {
      const key = `runs/${runId}/figma/frame-${Date.now()}.png`;
      try {
        await storage.upload(key, imageBuffer, "image/png");
        storageKey = key;
      } catch (err) {
        logger.warn({ err, runId }, "Figma image upload failed; continuing without storage key");
      }
    }

    await db.figmaReference.update({
      where: { id: figmaRefId },
      data: {
        storageKey: storageKey ?? null,
        metadataJson: metadataJson as object,
        status: "ready",
      },
    });

    logger.info({ runId, storageKey }, "FigmaReference persisted with status=ready");
    return imageBuffer;
  } catch (error) {
    logger.error({ error, runId }, "Figma fetch failed; marking FigmaReference as failed");
    try {
      await db.figmaReference.update({
        where: { id: figmaRefId },
        data: { status: "failed" },
      });
    } catch (dbErr) {
      logger.warn({ dbErr, runId }, "Failed to update FigmaReference status to failed");
    }
    return undefined;
  }
}

// ─── Job processor ────────────────────────────────────────────────────────────

export async function processAuditJob(job: Job): Promise<void> {
  const parsedJob = AuditJobSchema.parse(job.data) satisfies AuditJobRequest;
  logger.info({ jobId: job.id, data: parsedJob }, "Processing audit job");
  const storage = tryGetStorage();
  const summaries: ViewportExecutionSummary[] = [];
  // Collect screenshot buffers keyed by viewport for later Figma comparison
  const screenshotBuffers = new Map<string, { buffer: Buffer; viewportRunId: string | undefined }>();

  await updateAuditRunStatus(parsedJob.runId, "capturing");

  for (let index = 0; index < parsedJob.viewports.length; index += 1) {
    const viewport = parsedJob.viewports[index]!;
    const viewportRunId = parsedJob.viewportRunIds?.[viewport];

    try {
      await updateViewportRunStatus(viewportRunId, "capturing");

      const captureResult = await capture(parsedJob.url, viewport);
      screenshotBuffers.set(viewport, { buffer: captureResult.screenshotBuffer, viewportRunId });
      const capturedAt = new Date();
      const artifact = await uploadCaptureArtifact(
        storage,
        parsedJob.runId,
        viewport,
        captureResult
      );

      if (artifact.storageKey) {
        await persistCaptureArtifact(viewportRunId, artifact.storageKey, capturedAt);
      }

      await updateViewportRunStatus(viewportRunId, "running_rules");

      const ruleResults = runRules(ALL_RULES, captureResult.domSnapshot);

      await persistFindings(viewportRunId, ruleResults);

      // Persist accessibility violations (axe-core) as findings
      await persistAccessibilityFindings(viewportRunId, captureResult.accessibilityViolations);

      await updateViewportRunStatus(viewportRunId, "rules_complete");

      summaries.push({
        viewport,
        findingsCount: ruleResults.length,
        storageKey: artifact.storageKey,
        signedUrl: artifact.signedUrl,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ err, viewport, viewportRunId }, "Viewport job failed");
      await updateViewportRunStatus(viewportRunId, "failed", {
        errorCode: "capture_or_rules_error",
        errorMessage,
      });
      summaries.push({ viewport, findingsCount: 0, failed: true });
    }

    const progress = Math.round(((index + 1) / parsedJob.viewports.length) * 100);
    if (typeof job.updateProgress === "function") {
      await job.updateProgress(progress);
    }
  }

  const anyFailed = summaries.some((s) => s.failed);
  const finalStatus = anyFailed ? "failed" : "rules_complete";
  await updateAuditRunStatus(parsedJob.runId, finalStatus);

  // ── Figma reference fetch + visual comparison (best-effort) ────────────────
  if (parsedJob.figmaFrameUrl) {
    const figmaBuffer = await processFigmaReference(parsedJob.runId, parsedJob.figmaFrameUrl, storage);
    if (figmaBuffer) {
      for (const [viewport, { buffer, viewportRunId }] of screenshotBuffers) {
        await generateComparisonFindings(
          viewportRunId,
          figmaBuffer,
          buffer,
          storage,
          parsedJob.runId,
          viewport
        );
      }
    }
  }

  logger.info(
    {
      jobId: job.id,
      runId: parsedJob.runId,
      viewportsProcessed: summaries.length,
      summaries,
    },
    "Audit job capture and rules execution completed"
  );

  // ── Slack notification (best-effort, skipped when SLACK_WEBHOOK_URL is absent) ─
  try {
    const allFindings = await db.finding.findMany({
      where: { viewportRun: { auditRunId: parsedJob.runId } },
      select: { severity: true, title: true, ruleId: true, description: true },
      orderBy: [{ severity: "asc" }],
      take: 50,
    });
    await notifySlack({
      runId: parsedJob.runId,
      projectId: parsedJob.projectId,
      url: parsedJob.url,
      status: anyFailed ? "failed" : "complete",
      findings: allFindings.map((f) => ({
        severity: f.severity,
        title: f.title,
        ruleId: f.ruleId,
        description: f.description,
      })),
      webBaseUrl: process.env["WEB_BASE_URL"],
    });
  } catch (err) {
    logger.warn({ err, runId: parsedJob.runId }, "Slack notification failed; continuing");
  }
}

// ─── Create worker ────────────────────────────────────────────────────────────

export function createWorker(concurrency = 2) {
  const worker = new Worker(AUDIT_QUEUE_NAME, processAuditJob, {
    connection: getRedisConnection(),
    concurrency,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });

  return worker;
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export function registerShutdownHandlers(worker: Worker) {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received — closing worker");
    await worker.close();
    logger.info("Worker closed cleanly");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

// ─── Start (only when run directly) ──────────────────────────────────────────

if (process.env["ODQA_START_WORKER"] === "1") {
  const concurrency = Number(process.env["WORKER_CONCURRENCY"] ?? 2);
  const worker = createWorker(concurrency);
  registerShutdownHandlers(worker);
  logger.info(
    { queue: AUDIT_QUEUE_NAME, concurrency },
    "Worker started and listening for jobs"
  );
}
