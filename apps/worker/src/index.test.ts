import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUDIT_QUEUE_NAME, processAuditJob, generateComparisonFindings, createWorker, registerShutdownHandlers } from "./index.js";
import type { Job, Worker } from "bullmq";

const {
  captureMock,
  runRulesMock,
  uploadMock,
  getSignedUrlMock,
  diffMock,
  clusterRegionsMock,
} = vi.hoisted(() => ({
  captureMock: vi.fn(),
  runRulesMock: vi.fn(),
  uploadMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
  diffMock: vi.fn(),
  clusterRegionsMock: vi.fn(),
}));

vi.mock("@opendesign-qa/capture", () => ({
  capture: captureMock,
}));

vi.mock("@opendesign-qa/compare", () => ({
  diff: diffMock,
  clusterRegions: clusterRegionsMock,
}));

vi.mock("@opendesign-qa/figma", () => ({
  parseFigmaFrameReference: vi.fn(() => ({ fileKey: "abc123", nodeId: "5:10" })),
  isParseError: vi.fn(() => false),
}));

vi.mock("@opendesign-qa/db", () => ({
  db: {
    auditRun: {
      update: vi.fn().mockResolvedValue({}),
    },
    viewportRun: {
      update: vi.fn().mockResolvedValue({}),
    },
    captureArtifact: {
      create: vi.fn().mockResolvedValue({}),
    },
    figmaReference: {
      create: vi.fn().mockResolvedValue({ id: "figma-ref-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    finding: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
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

    diffMock.mockResolvedValue({
      diffBuffer: Buffer.from("diff"),
      mismatchRatio: 0.1,
      mismatchCount: 10,
      width: 100,
      height: 100,
    });
    clusterRegionsMock.mockResolvedValue([]);
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

describe("generateComparisonFindings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diffMock.mockResolvedValue({
      diffBuffer: Buffer.from("diff"),
      mismatchRatio: 0.1,
      mismatchCount: 10,
      width: 100,
      height: 100,
    });
    clusterRegionsMock.mockResolvedValue([]);
  });

  it("calls diff and clusterRegions with the provided buffers", async () => {
    const figmaBuffer = Buffer.from("figma");
    const screenshotBuffer = Buffer.from("screenshot");

    await generateComparisonFindings(
      "viewport-run-1",
      figmaBuffer,
      screenshotBuffer,
      undefined,
      "run-1",
      "desktop"
    );

    expect(diffMock).toHaveBeenCalledWith(figmaBuffer, screenshotBuffer);
    expect(clusterRegionsMock).toHaveBeenCalledTimes(1);
  });

  it("does not call clusterRegions when mismatchRatio is 0", async () => {
    diffMock.mockResolvedValue({
      diffBuffer: Buffer.from("diff"),
      mismatchRatio: 0,
      mismatchCount: 0,
      width: 100,
      height: 100,
    });

    await generateComparisonFindings(
      "viewport-run-1",
      Buffer.from("figma"),
      Buffer.from("screenshot"),
      undefined,
      "run-1",
      "desktop"
    );

    expect(diffMock).toHaveBeenCalledTimes(1);
    expect(clusterRegionsMock).not.toHaveBeenCalled();
  });

  it("persists a Finding for each region returned by clusterRegions", async () => {
    const { db } = await import("@opendesign-qa/db");
    (db.$transaction as ReturnType<typeof vi.fn>).mockClear();

    clusterRegionsMock.mockResolvedValue([
      { x: 10, y: 20, width: 50, height: 60, area: 3000, mismatchPixels: 500, type: "missing" },
      { x: 80, y: 90, width: 30, height: 40, area: 1200, mismatchPixels: 200, type: "restyled" },
    ]);

    await generateComparisonFindings(
      "viewport-run-1",
      Buffer.from("figma"),
      Buffer.from("screenshot"),
      undefined,
      "run-1",
      "desktop"
    );

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // $transaction is called with an array of 2 create promises
    const calls = (db.$transaction as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(Array.isArray(calls?.[0])).toBe(true);
    expect(calls?.[0] as unknown[]).toHaveLength(2);
  });

  it("maps region types to correct ruleIds and severities", async () => {
    const { db } = await import("@opendesign-qa/db");
    const findingCreateMock = db.finding.create as ReturnType<typeof vi.fn>;
    findingCreateMock.mockClear();
    // $transaction calls each create promise; mock $transaction to invoke them
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (ops: Promise<unknown>[]) => Promise.all(ops)
    );

    clusterRegionsMock.mockResolvedValue([
      { x: 0, y: 0, width: 20, height: 20, area: 400, mismatchPixels: 100, type: "missing" },
      { x: 30, y: 30, width: 20, height: 20, area: 400, mismatchPixels: 80, type: "misaligned" },
      { x: 60, y: 60, width: 20, height: 20, area: 400, mismatchPixels: 50, type: "restyled" },
    ]);

    await generateComparisonFindings(
      "viewport-run-1",
      Buffer.from("figma"),
      Buffer.from("screenshot"),
      undefined,
      "run-1",
      "desktop"
    );

    expect(findingCreateMock).toHaveBeenCalledTimes(3);

    const calls = (findingCreateMock.mock.calls as Array<[{ data: Record<string, unknown> }]>).map((c) => c[0].data);
    expect(calls[0]).toMatchObject({ ruleId: "figma-diff/missing", severity: "high" });
    expect(calls[1]).toMatchObject({ ruleId: "figma-diff/misaligned", severity: "medium" });
    expect(calls[2]).toMatchObject({ ruleId: "figma-diff/restyled", severity: "low" });

    // Restore default mock behaviour
    (db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("does not throw when viewportRunId is undefined", async () => {
    await expect(
      generateComparisonFindings(undefined, Buffer.from("a"), Buffer.from("b"), undefined, "run-1", "desktop")
    ).resolves.toBeUndefined();
    expect(diffMock).not.toHaveBeenCalled();
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
