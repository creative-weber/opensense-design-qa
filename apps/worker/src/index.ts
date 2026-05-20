import { Worker, type Job } from "bullmq";
import pino from "pino";
import { AuditJobSchema, type AuditJobRequest } from "@opendesign-qa/contracts";
import { capture, type CaptureResult } from "@opendesign-qa/capture";
import { runRules } from "@opendesign-qa/rules-core";
import { ALL_RULES } from "@opendesign-qa/rules-web";
import { getStorage, type StorageAdapter } from "@opendesign-qa/storage";

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
  await storage.upload(storageKey, captureResult.screenshotBuffer, "image/png");
  const signedUrl = await storage.getSignedUrl(storageKey);
  return { storageKey, signedUrl };
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

// ─── Job processor ────────────────────────────────────────────────────────────

export async function processAuditJob(job: Job): Promise<void> {
  const parsedJob = AuditJobSchema.parse(job.data) satisfies AuditJobRequest;
  logger.info({ jobId: job.id, data: parsedJob }, "Processing audit job");
  const storage = tryGetStorage();
  const summaries: ViewportExecutionSummary[] = [];

  for (let index = 0; index < parsedJob.viewports.length; index += 1) {
    const viewport = parsedJob.viewports[index]!;
    const captureResult = await capture(parsedJob.url, viewport);
    const ruleResults = runRules(ALL_RULES, captureResult.domSnapshot);
    const artifact = await uploadCaptureArtifact(
      storage,
      parsedJob.runId,
      viewport,
      captureResult
    );

    summaries.push({
      viewport,
      findingsCount: ruleResults.length,
      storageKey: artifact.storageKey,
      signedUrl: artifact.signedUrl,
    });

    const progress = Math.round(((index + 1) / parsedJob.viewports.length) * 100);
    if (typeof job.updateProgress === "function") {
      await job.updateProgress(progress);
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
