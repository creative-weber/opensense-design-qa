import { describe, it, expect } from "vitest";
import { generateJsonReport, generateMarkdownReport } from "./report.js";
import type { ReportRun, ReportFinding, ReportArtifact } from "./report.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RUN: ReportRun = {
  id: "run-001",
  projectId: "proj-001",
  url: "https://example.com",
  status: "rules_complete",
  createdAt: new Date("2026-05-24T10:00:00.000Z"),
};

const FINDINGS: ReportFinding[] = [
  {
    id: "f-001",
    viewportRunId: "vr-001",
    ruleId: "overflow",
    title: "Horizontal overflow on body",
    description: "The body element overflows the viewport horizontally.",
    severity: "high",
    evidence: [{ domSelector: "body", computedValue: "scroll", screenshotRegion: { x: 0, y: 0, width: 100, height: 50 } }],
  },
  {
    id: "f-002",
    viewportRunId: "vr-001",
    ruleId: "contrast-warning",
    title: "Low contrast text",
    description: "Text contrast ratio is below WCAG AA.",
    severity: "medium",
    evidence: [{ domSelector: "p.subtitle", computedValue: "#aaa on #fff" }],
  },
  {
    id: "f-003",
    viewportRunId: "vr-002",
    ruleId: "alignment-drift",
    title: "Alignment drift detected",
    description: "Element is offset from its expected position.",
    severity: "low",
    evidence: [],
  },
  {
    id: "f-004",
    viewportRunId: "vr-001",
    ruleId: "overlap",
    title: "Element overlap",
    description: "Two elements overlap each other.",
    severity: "critical",
    evidence: [{ screenshotRegion: { x: 10, y: 20, width: 80, height: 40 } }],
  },
];

const ARTIFACTS: ReportArtifact[] = [
  { id: "art-001", artifactType: "screenshot", storageKey: "screenshots/run-001/desktop.png", signedUrl: "https://cdn.example.com/desktop.png" },
  { id: "art-002", artifactType: "figma_frame", storageKey: "figma/run-001/frame.png" },
];

// ─── generateJsonReport ───────────────────────────────────────────────────────

describe("generateJsonReport", () => {
  it("returns run metadata unchanged", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    expect(report.run.id).toBe("run-001");
    expect(report.run.projectId).toBe("proj-001");
    expect(report.run.url).toBe("https://example.com");
    expect(report.run.status).toBe("rules_complete");
  });

  it("counts findings by severity correctly", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    expect(report.summary.totalFindings).toBe(4);
    expect(report.summary.critical).toBe(1);
    expect(report.summary.high).toBe(1);
    expect(report.summary.medium).toBe(1);
    expect(report.summary.low).toBe(1);
    expect(report.summary.info).toBe(0);
  });

  it("sorts topBlockingFindings by severity descending (critical first)", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    const severities = report.topBlockingFindings.map((f) => f.severity);
    expect(severities[0]).toBe("critical");
    expect(severities[1]).toBe("high");
    expect(severities[2]).toBe("medium");
    expect(severities[3]).toBe("low");
  });

  it("caps topBlockingFindings at 10 items", () => {
    const manyFindings: ReportFinding[] = Array.from({ length: 15 }, (_, i) => ({
      id: `f-${i}`,
      viewportRunId: "vr-001",
      ruleId: "overflow",
      title: `Finding ${i}`,
      description: "desc",
      severity: "low" as const,
      evidence: [],
    }));
    const report = generateJsonReport(RUN, manyFindings, []);
    expect(report.topBlockingFindings).toHaveLength(10);
  });

  it("builds evidence links for findings with screenshotRegion", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    const criticalFinding = report.topBlockingFindings.find((f) => f.severity === "critical");
    expect(criticalFinding?.evidenceLinks).toEqual(["region:10,20,80,40"]);
  });

  it("returns empty evidenceLinks for findings with no screenshotRegion", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    const lowFinding = report.topBlockingFindings.find((f) => f.ruleId === "alignment-drift");
    expect(lowFinding?.evidenceLinks).toEqual([]);
  });

  it("includes artifacts in the report", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    expect(report.artifacts).toHaveLength(2);
    expect(report.artifacts[0]?.artifactType).toBe("screenshot");
  });

  it("returns zero summary counts for an empty findings array", () => {
    const report = generateJsonReport(RUN, [], []);
    expect(report.summary.totalFindings).toBe(0);
    expect(report.summary.critical).toBe(0);
    expect(report.summary.high).toBe(0);
    expect(report.topBlockingFindings).toHaveLength(0);
  });

  it("includes nextActions for each blocking finding", () => {
    const report = generateJsonReport(RUN, FINDINGS, ARTIFACTS);
    for (const finding of report.topBlockingFindings) {
      expect(finding.nextActions.length).toBeGreaterThanOrEqual(1);
      expect(finding.nextActions[0]).toContain(finding.ruleId);
    }
  });
});

// ─── generateMarkdownReport ───────────────────────────────────────────────────

describe("generateMarkdownReport", () => {
  it("opens with a heading containing the run id", () => {
    const md = generateMarkdownReport(RUN, FINDINGS, ARTIFACTS);
    expect(md).toMatch(/^# Audit Report: run-001/);
  });

  it("includes the target URL in the report", () => {
    const md = generateMarkdownReport(RUN, FINDINGS, ARTIFACTS);
    expect(md).toContain("https://example.com");
  });

  it("includes a severity summary table", () => {
    const md = generateMarkdownReport(RUN, FINDINGS, ARTIFACTS);
    expect(md).toContain("## Severity Summary");
    expect(md).toContain("| Critical |");
    expect(md).toContain("| High     |");
  });

  it("lists top blocking findings with title and severity", () => {
    const md = generateMarkdownReport(RUN, FINDINGS, ARTIFACTS);
    expect(md).toContain("Element overlap");
    expect(md).toContain("(critical)");
    expect(md).toContain("Horizontal overflow on body");
  });

  it("includes artifacts section when artifacts are provided", () => {
    const md = generateMarkdownReport(RUN, FINDINGS, ARTIFACTS);
    expect(md).toContain("## Artifacts");
    expect(md).toContain("screenshot");
    expect(md).toContain("desktop.png");
  });

  it("omits artifacts section when no artifacts are provided", () => {
    const md = generateMarkdownReport(RUN, FINDINGS, []);
    expect(md).not.toContain("## Artifacts");
  });

  it("shows 'No findings detected' when findings array is empty", () => {
    const md = generateMarkdownReport(RUN, [], []);
    expect(md).toContain("No findings detected.");
  });

  it("accepts a string createdAt without throwing", () => {
    const runWithStringDate: ReportRun = { ...RUN, createdAt: "2026-05-24T10:00:00.000Z" };
    expect(() => generateMarkdownReport(runWithStringDate, [], [])).not.toThrow();
  });
});
