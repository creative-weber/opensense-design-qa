import type { FindingSeverity } from "@opendesign-qa/contracts";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ReportRun {
  id: string;
  projectId: string;
  url: string;
  status: string;
  createdAt: Date | string;
}

export interface ReportFindingEvidence {
  domSelector?: string;
  computedValue?: string;
  expectedValue?: string;
  screenshotRegion?: { x: number; y: number; width: number; height: number };
  additionalData?: Record<string, unknown>;
}

export interface ReportFinding {
  id: string;
  viewportRunId?: string;
  ruleId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  evidence: ReportFindingEvidence[];
}

export interface ReportArtifact {
  id: string;
  artifactType: string;
  storageKey: string;
  signedUrl?: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ReportSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ReportBlockingFinding {
  id: string;
  ruleId: string;
  title: string;
  severity: FindingSeverity;
  description: string;
  evidenceLinks: string[];
  nextActions: string[];
}

export interface JsonReport {
  run: {
    id: string;
    projectId: string;
    url: string;
    status: string;
    createdAt: Date | string;
  };
  summary: ReportSummary;
  topBlockingFindings: ReportBlockingFinding[];
  artifacts: ReportArtifact[];
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

function getSeverityWeight(severity: FindingSeverity): number {
  return SEVERITY_WEIGHT[severity] ?? 0;
}

function getEvidenceLinks(finding: ReportFinding): string[] {
  return finding.evidence
    .filter((e) => e.screenshotRegion)
    .map((e) => {
      const r = e.screenshotRegion!;
      return `region:${r.x},${r.y},${r.width},${r.height}`;
    });
}

// ─── generateJsonReport ───────────────────────────────────────────────────────

/**
 * Produces a structured JSON export payload for a completed audit run.
 *
 * @param run      - Minimal run metadata.
 * @param findings - All findings for the run (any order, any severity).
 * @param artifacts - All artifacts associated with the run.
 * @returns        A typed {@link JsonReport} ready for serialization.
 */
export function generateJsonReport(
  run: ReportRun,
  findings: ReportFinding[],
  artifacts: ReportArtifact[],
): JsonReport {
  const sorted = [...findings].sort(
    (a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity),
  );

  const summary: ReportSummary = {
    totalFindings: sorted.length,
    critical: sorted.filter((f) => f.severity === "critical").length,
    high: sorted.filter((f) => f.severity === "high").length,
    medium: sorted.filter((f) => f.severity === "medium").length,
    low: sorted.filter((f) => f.severity === "low").length,
    info: sorted.filter((f) => f.severity === "info").length,
  };

  const topBlockingFindings: ReportBlockingFinding[] = sorted
    .slice(0, 10)
    .map((finding) => ({
      id: finding.id,
      ruleId: finding.ruleId,
      title: finding.title,
      severity: finding.severity,
      description: finding.description,
      evidenceLinks: getEvidenceLinks(finding),
      nextActions: [
        `Inspect rule ${finding.ruleId} evidence and affected selectors`,
        "Apply fix and re-run audit to confirm resolution",
      ],
    }));

  return {
    run: {
      id: run.id,
      projectId: run.projectId,
      url: run.url,
      status: run.status,
      createdAt: run.createdAt,
    },
    summary,
    topBlockingFindings,
    artifacts,
  };
}

// ─── generateMarkdownReport ───────────────────────────────────────────────────

/**
 * Produces a human-readable Markdown string summarising an audit run.
 *
 * @param run      - Minimal run metadata.
 * @param findings - All findings for the run.
 * @param artifacts - All artifacts associated with the run.
 * @returns        A UTF-8 Markdown string.
 */
export function generateMarkdownReport(
  run: ReportRun,
  findings: ReportFinding[],
  artifacts: ReportArtifact[],
): string {
  const report = generateJsonReport(run, findings, artifacts);
  const { summary, topBlockingFindings } = report;

  const createdAt =
    run.createdAt instanceof Date
      ? run.createdAt.toISOString()
      : String(run.createdAt);

  const lines: string[] = [
    `# Audit Report: ${run.id}`,
    "",
    `- **Project ID:** ${run.projectId}`,
    `- **URL:** ${run.url}`,
    `- **Status:** ${run.status}`,
    `- **Created At:** ${createdAt}`,
    "",
    "## Severity Summary",
    "",
    `| Severity | Count |`,
    `|---|---|`,
    `| Critical | ${summary.critical} |`,
    `| High     | ${summary.high} |`,
    `| Medium   | ${summary.medium} |`,
    `| Low      | ${summary.low} |`,
    `| Info     | ${summary.info} |`,
    `| **Total**| **${summary.totalFindings}** |`,
    "",
  ];

  if (topBlockingFindings.length === 0) {
    lines.push("## Findings", "", "No findings detected.", "");
  } else {
    lines.push("## Top Blocking Findings", "");
    for (const [index, finding] of topBlockingFindings.entries()) {
      lines.push(
        `### ${index + 1}. ${finding.title} (${finding.severity})`,
        "",
        `- **Rule:** \`${finding.ruleId}\``,
        `- **Description:** ${finding.description}`,
        `- **Evidence links:** ${finding.evidenceLinks.length > 0 ? finding.evidenceLinks.join(", ") : "None"}`,
        `- **Next actions:**`,
        ...finding.nextActions.map((a) => `  - ${a}`),
        "",
      );
    }
  }

  if (artifacts.length > 0) {
    lines.push("## Artifacts", "");
    for (const artifact of artifacts) {
      const link = artifact.signedUrl ? ` — [view](${artifact.signedUrl})` : "";
      lines.push(`- \`${artifact.artifactType}\`: \`${artifact.storageKey}\`${link}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
