import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUDIT_QUEUE_NAME, processAuditJob, createWorker, registerShutdownHandlers } from "./index.js";
import type { Job, Worker } from "bullmq";

const {
  captureMock,
  runRulesMock,
  uploadMock,
  getSignedUrlMock,
} = vi.hoisted(() => ({
  captureMock: vi.fn(),
  runRulesMock: vi.fn(),
  uploadMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@opendesign-qa/capture", () => ({
  capture: captureMock,
}));

vi.mock("@opendesign-qa/rules-core", () => ({
  runRules: runRulesMock,
}));

vi.mock("@opendesign-qa/rules-web", () => ({
  ALL_RULES: [{ id: "overflow-clipping" }],
}));

vi.mock("@opendesign-qa/storage", () => ({
  getStorage: () => ({
    upload: uploadMock,
    getSignedUrl: getSignedUrlMock,
  }),
}));

// ─── Mock BullMQ so tests don't need a live Redis ────────────────────────────

vi.mock("bullmq", () => {
  const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const MockWorker = vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(handler);
    }),
    close: vi.fn().mockResolvedValue(undefined),
    _eventHandlers: eventHandlers,
  }));

  return { Worker: MockWorker };
});

describe("AUDIT_QUEUE_NAME", () => {
  it("is audit-jobs", () => {
    expect(AUDIT_QUEUE_NAME).toBe("audit-jobs");
  });
});

describe("processAuditJob", () => {
  beforeEach(() => {
    captureMock.mockResolvedValue({
      screenshotBuffer: Buffer.from("png"),
      viewport: "desktop",
      url: "https://example.com",
      capturedAt: new Date(),
      domSnapshot: [],
    });
    runRulesMock.mockReturnValue([
      {
        ruleId: "overflow-clipping",
        title: "Overflow",
        description: "Overflow detected",
        severity: "high",
        confidence: 0.9,
        evidence: [],
      },
    ]);
    uploadMock.mockResolvedValue({
      key: "runs/run-1/desktop/screenshot-1.png",
      bucket: "odqa",
      sizeBytes: 3,
    });
    getSignedUrlMock.mockResolvedValue("https://storage.local/signed");
  });

  it("processes a job without throwing", async () => {
    const fakeJob = {
      id: "job-1",
      data: {
        runId: "550e8400-e29b-41d4-a716-446655440000",
        projectId: "550e8400-e29b-41d4-a716-446655440001",
        url: "https://example.com",
        viewports: ["desktop"],
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job;
    await expect(processAuditJob(fakeJob)).resolves.toBeUndefined();
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(runRulesMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed job payloads", async () => {
    const fakeJob = {
      id: "job-2",
      data: { runId: "bad", projectId: "bad", url: "not-a-url", viewports: [] },
    } as unknown as Job;

    await expect(processAuditJob(fakeJob)).rejects.toBeDefined();
  });
});

describe("createWorker", () => {
  it("creates a Worker connected to the audit-jobs queue", async () => {
    const { Worker } = await import("bullmq");
    const worker = createWorker(1);

    expect(Worker).toHaveBeenCalledWith(
      AUDIT_QUEUE_NAME,
      processAuditJob,
      expect.objectContaining({ concurrency: 1 })
    );
    expect(worker).toBeDefined();
  });
});

describe("registerShutdownHandlers", () => {
  let originalProcessOn: typeof process.on;
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    originalProcessOn = process.on.bind(process);
    originalProcessExit = process.exit.bind(process);
    vi.spyOn(process, "on").mockImplementation(vi.fn() as typeof process.on);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
    vi.restoreAllMocks();
  });

  it("registers SIGTERM and SIGINT handlers", () => {
    const fakeWorker = { close: vi.fn().mockResolvedValue(undefined) } as unknown as Worker;
    registerShutdownHandlers(fakeWorker);

    const calls = (process.on as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain("SIGTERM");
    expect(calls).toContain("SIGINT");
  });
});
