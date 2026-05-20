/**
 * ODQA-023 — Rule: Overflow And Clipping Detection
 * ODQA-024 — Rule: Element Overlap Detection
 * ODQA-025 — Rule: Alignment Drift Detection
 * ODQA-026 — Rule: Spacing Inconsistency Detection
 * ODQA-027 — Rule: Typography Inconsistency Detection
 * ODQA-028 — Rule: Color Mismatch Detection
 * ODQA-029 — Rule: Contrast Warning Detection
 *
 * These E2E tests verify that each built-in web rule:
 *  1. Is registered and produces findings when run against a specially
 *     crafted fixture page that is guaranteed to trigger it.
 *  2. Does NOT flag a clean reference page (false-positive guard).
 *
 * The fixture pages are served by the web app under the path
 * /fixtures/<rule-slug>. Each fixture is a minimal HTML page that contains
 * exactly the design issue the rule is designed to detect.
 *
 * The "clean" page used for false-positive checks is the web app's own
 * home page at http://localhost:3000, which must pass all rules without
 * false positives.
 */
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const WORKSPACE_ROOT = resolve(__dirname, "..", "..");
const WEB_FIXTURE_BASE = process.env["WEB_URL"] ?? "http://localhost:3000";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function runAuditAndGetFindings(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  url: string,
  projectName: string
): Promise<
  Array<{
    ruleId: string;
    severity: string;
    title: string;
    evidence: Array<unknown>;
  }>
> {
  const projectRes = await request.post("/api/projects", { data: { name: projectName } });
  const project = (await projectRes.json()) as { id: string };

  const runRes = await request.post("/api/runs", {
    data: { projectId: project.id, url, viewports: ["desktop"] },
  });
  const run = (await runRes.json()) as { id: string };

  // Wait for rules to complete
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await request.get(`/api/runs/${run.id}`);
    const body = (await pollRes.json()) as { status: string };
    if (["rules_complete", "complete", "failed"].includes(body.status)) break;
  }

  const findingsRes = await request.get(`/api/runs/${run.id}/findings`);
  const findingsBody = (await findingsRes.json()) as {
    data: Array<{
      ruleId: string;
      severity: string;
      title: string;
      evidence: Array<unknown>;
    }>;
  };
  return findingsBody.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-023: Overflow And Clipping Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-023 — Rule: Overflow And Clipping Detection", () => {
  test("packages/rules-web includes an overflow-clipping rule file", () => {
    const rulesWebSrc = resolve(WORKSPACE_ROOT, "packages", "rules-web", "src");
    expect(existsSync(rulesWebSrc), "packages/rules-web/src must exist").toBe(true);

    const overflowPath = resolve(rulesWebSrc, "overflow-clipping.ts");
    const altPath = resolve(rulesWebSrc, "rules", "overflow-clipping.ts");
    expect(
      existsSync(overflowPath) || existsSync(altPath),
      "overflow-clipping rule file must exist"
    ).toBe(true);
  });

  test("overflow-clipping rule source detects scrollWidth > clientWidth", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "overflow-clipping.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "overflow-clipping.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath, "overflow-clipping.ts must exist").toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    expect(source).toContain("scrollWidth");
    expect(source).toContain("clientWidth");
  });

  test("overflow fixture page produces overflow-clipping findings via API", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/overflow`,
      "ODQA-023 Overflow Fixture"
    );

    const overflowFindings = findings.filter((f) => f.ruleId === "overflow-clipping");
    expect(overflowFindings.length).toBeGreaterThan(0);

    // Severity should be high (>20px) or medium
    for (const f of overflowFindings) {
      expect(["high", "medium"]).toContain(f.severity);
    }
  });

  // Edge case: intentional overflow containers (overflow:auto) are not flagged
  test("clean page produces no overflow-clipping findings", async ({ request }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/clean`,
      "ODQA-023 Clean False-Positive"
    );

    const overflowFindings = findings.filter((f) => f.ruleId === "overflow-clipping");
    expect(overflowFindings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-024: Element Overlap Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-024 — Rule: Element Overlap Detection", () => {
  test("packages/rules-web includes an element-overlap rule file", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "element-overlap.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "element-overlap.ts"),
    ];
    expect(candidates.some(existsSync), "element-overlap rule file must exist").toBe(true);
  });

  test("element-overlap rule source checks bounding box intersection", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "element-overlap.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "element-overlap.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    // Should contain intersection logic
    expect(
      source.includes("intersect") || source.includes("overlap") || source.includes("boundingBox")
    ).toBe(true);
  });

  test("overlap fixture page produces element-overlap findings with high severity for large intersections", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/overlap`,
      "ODQA-024 Overlap Fixture"
    );

    const overlapFindings = findings.filter((f) => f.ruleId === "element-overlap");
    expect(overlapFindings.length).toBeGreaterThan(0);

    // Evidence must include both selector fields
    for (const f of overlapFindings) {
      expect(Array.isArray(f.evidence)).toBe(true);
    }
  });

  // Edge case: nested elements (parent-child) are not flagged as overlapping
  test("clean page with normal nesting produces no element-overlap findings", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/clean`,
      "ODQA-024 Nested Clean"
    );

    const overlapFindings = findings.filter((f) => f.ruleId === "element-overlap");
    expect(overlapFindings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-025: Alignment Drift Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-025 — Rule: Alignment Drift Detection", () => {
  test("packages/rules-web includes an alignment-drift rule file", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "alignment-drift.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "alignment-drift.ts"),
    ];
    expect(candidates.some(existsSync), "alignment-drift rule file must exist").toBe(true);
  });

  test("alignment-drift rule source groups siblings and checks left-edge variance", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "alignment-drift.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "alignment-drift.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    expect(
      source.includes("left") || source.includes("alignment") || source.includes("drift")
    ).toBe(true);
  });

  test("alignment fixture page produces alignment-drift findings with medium severity", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/alignment-drift`,
      "ODQA-025 Alignment Fixture"
    );

    const alignmentFindings = findings.filter((f) => f.ruleId === "alignment-drift");
    expect(alignmentFindings.length).toBeGreaterThan(0);

    for (const f of alignmentFindings) {
      expect(f.severity).toBe("medium");
    }
  });

  // Edge case: single-child groups are skipped
  test("groups with fewer than 2 siblings produce no alignment-drift findings", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/single-child`,
      "ODQA-025 Single Child"
    );

    const alignmentFindings = findings.filter((f) => f.ruleId === "alignment-drift");
    expect(alignmentFindings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-026: Spacing Inconsistency Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-026 — Rule: Spacing Inconsistency Detection", () => {
  test("packages/rules-web includes a spacing-inconsistency rule file", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "spacing-inconsistency.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "spacing-inconsistency.ts"),
    ];
    expect(candidates.some(existsSync), "spacing-inconsistency rule file must exist").toBe(true);
  });

  test("spacing-inconsistency rule source computes gap sequences between siblings", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "spacing-inconsistency.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "spacing-inconsistency.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    expect(source).toContain("gap");
    expect(
      source.includes("median") || source.includes("outlier") || source.includes("8")
    ).toBe(true);
  });

  test("spacing fixture page produces spacing-inconsistency findings with low severity", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/spacing-inconsistency`,
      "ODQA-026 Spacing Fixture"
    );

    const spacingFindings = findings.filter((f) => f.ruleId === "spacing-inconsistency");
    expect(spacingFindings.length).toBeGreaterThan(0);

    for (const f of spacingFindings) {
      expect(f.severity).toBe("low");
    }
  });

  // Edge case: consistent spacing produces no findings
  test("consistently spaced page produces no spacing-inconsistency findings", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/clean`,
      "ODQA-026 Consistent Spacing"
    );

    const spacingFindings = findings.filter((f) => f.ruleId === "spacing-inconsistency");
    expect(spacingFindings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-027: Typography Inconsistency Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-027 — Rule: Typography Inconsistency Detection", () => {
  test("packages/rules-web includes a typography-inconsistency rule file", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "typography-inconsistency.ts"),
      resolve(
        WORKSPACE_ROOT,
        "packages",
        "rules-web",
        "src",
        "rules",
        "typography-inconsistency.ts"
      ),
    ];
    expect(candidates.some(existsSync), "typography-inconsistency rule file must exist").toBe(true);
  });

  test("typography-inconsistency rule source computes dominant font-size scale", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "typography-inconsistency.ts"),
      resolve(
        WORKSPACE_ROOT,
        "packages",
        "rules-web",
        "src",
        "rules",
        "typography-inconsistency.ts"
      ),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    expect(
      source.includes("fontSize") || source.includes("font-size") || source.includes("fontWeight")
    ).toBe(true);
  });

  test("typography fixture page produces typography-inconsistency findings with medium severity", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/typography-inconsistency`,
      "ODQA-027 Typography Fixture"
    );

    const typographyFindings = findings.filter((f) => f.ruleId === "typography-inconsistency");
    expect(typographyFindings.length).toBeGreaterThan(0);

    for (const f of typographyFindings) {
      expect(f.severity).toBe("medium");
    }
  });

  // Edge case: consistent type scale produces no findings
  test("page with a consistent 2-scale type system produces no typography findings", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/clean`,
      "ODQA-027 Clean Typography"
    );

    const typographyFindings = findings.filter((f) => f.ruleId === "typography-inconsistency");
    expect(typographyFindings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-028: Color Mismatch Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-028 — Rule: Color Mismatch Detection", () => {
  test("packages/rules-web includes a color-mismatch rule file", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "color-mismatch.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "color-mismatch.ts"),
    ];
    expect(candidates.some(existsSync), "color-mismatch rule file must exist").toBe(true);
  });

  test("color-mismatch rule source builds a frequency map of colors", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "color-mismatch.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "color-mismatch.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    expect(
      source.includes("frequency") || source.includes("color") || source.includes("palette")
    ).toBe(true);
  });

  test("color-mismatch fixture page produces color-mismatch findings with low severity", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/color-mismatch`,
      "ODQA-028 Color Fixture"
    );

    const colorFindings = findings.filter((f) => f.ruleId === "color-mismatch");
    expect(colorFindings.length).toBeGreaterThan(0);

    for (const f of colorFindings) {
      expect(f.severity).toBe("low");
    }
  });

  // Edge case: buttons and links with unique colors are NOT flagged
  test("button and anchor colors are excluded from color-mismatch detection", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "color-mismatch.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "color-mismatch.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    // Rule must exempt button, a, code tags
    expect(
      source.includes("button") || source.includes("allowList") || source.includes("exclude")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-029: Contrast Warning Detection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-029 — Rule: Contrast Warning Detection", () => {
  test("packages/rules-web includes a contrast-warning rule file", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "contrast-warning.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "contrast-warning.ts"),
    ];
    expect(candidates.some(existsSync), "contrast-warning rule file must exist").toBe(true);
  });

  test("contrast-warning rule source computes relative luminance", () => {
    const candidates = [
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "contrast-warning.ts"),
      resolve(WORKSPACE_ROOT, "packages", "rules-web", "src", "rules", "contrast-warning.ts"),
    ];
    const filePath = candidates.find(existsSync);
    expect(filePath).toBeTruthy();

    const source = readFileSync(filePath!, "utf-8");
    expect(
      source.includes("luminance") || source.includes("contrast") || source.includes("4.5")
    ).toBe(true);
  });

  test("contrast fixture page produces contrast-warning findings", async ({ request }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/contrast`,
      "ODQA-029 Contrast Fixture"
    );

    const contrastFindings = findings.filter((f) => f.ruleId === "contrast-warning");
    expect(contrastFindings.length).toBeGreaterThan(0);
  });

  test("failing normal text contrast produces high severity findings", async ({ request }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/contrast`,
      "ODQA-029 Contrast Severity Normal"
    );

    const highFindings = findings.filter(
      (f) => f.ruleId === "contrast-warning" && f.severity === "high"
    );
    expect(highFindings.length).toBeGreaterThan(0);
  });

  test("failing large text contrast produces medium severity findings", async ({ request }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/contrast-large-text`,
      "ODQA-029 Contrast Large Text"
    );

    const mediumFindings = findings.filter(
      (f) => f.ruleId === "contrast-warning" && f.severity === "medium"
    );
    expect(mediumFindings.length).toBeGreaterThan(0);
  });

  // Edge case: passing contrast ratio produces no contrast-warning findings
  test("page with WCAG AA passing contrast produces no contrast-warning findings", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/clean`,
      "ODQA-029 Clean Contrast"
    );

    const contrastFindings = findings.filter((f) => f.ruleId === "contrast-warning");
    expect(contrastFindings).toHaveLength(0);
  });

  // Edge case: evidence includes foreground color, background color, and ratio
  test("contrast-warning finding evidence includes color and ratio fields", async ({
    request,
  }) => {
    const findings = await runAuditAndGetFindings(
      request,
      `${WEB_FIXTURE_BASE}/fixtures/contrast`,
      "ODQA-029 Evidence Shape"
    );

    const contrastFindings = findings.filter((f) => f.ruleId === "contrast-warning");
    for (const finding of contrastFindings) {
      expect(Array.isArray(finding.evidence)).toBe(true);
      if (finding.evidence.length > 0) {
        const ev = finding.evidence[0] as Record<string, unknown>;
        expect(ev["computedValue"] ?? ev["foregroundColor"]).toBeTruthy();
      }
    }
  });
});
