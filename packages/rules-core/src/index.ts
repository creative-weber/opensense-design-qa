import type { DomSnapshot } from "@opendesign-qa/capture";

// ─── Severity ─────────────────────────────────────────────────────────────────

export type FindingSeverity = "high" | "medium" | "low";

// ─── Evidence ─────────────────────────────────────────────────────────────────

export interface Evidence {
  screenshotRegion?: { x: number; y: number; width: number; height: number };
  domSelector?: string;
  computedValue?: string;
  expectedValue?: string;
}

// ─── Rule result ──────────────────────────────────────────────────────────────

export interface RuleResult {
  ruleId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
  evidence: Evidence[];
}

// ─── Rule interface ───────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  name: string;
  severity: FindingSeverity;
  run(snapshot: DomSnapshot[]): RuleResult[];
}

// ─── Rule execution harness ───────────────────────────────────────────────────

export function runRules(rules: Rule[], snapshot: DomSnapshot[]): RuleResult[] {
  const results: RuleResult[] = [];

  for (const rule of rules) {
    try {
      const ruleResults = rule.run(snapshot);
      results.push(...ruleResults);
    } catch (err) {
      // A failed rule logs a warning but does not crash the pipeline.
      // Its failure is recorded as a system-error result.
      console.warn(`[rules-core] Rule ${rule.id} threw an error:`, err);
      results.push({
        ruleId: rule.id,
        title: `Rule execution error: ${rule.id}`,
        description: err instanceof Error ? err.message : String(err),
        severity: "low",
        confidence: 0,
        evidence: [],
      });
    }
  }

  return results;
}
