import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-026 — Spacing Inconsistency Detection
 *
 * Detects vertical or horizontal gaps between sequential siblings that break a
 * consistent spacing rhythm. An outlier gap is flagged when it deviates more
 * than 8px from the median gap in its group. Severity: low.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export const spacingInconsistencyRule: Rule = {
  id: "spacing-inconsistency",
  name: "Spacing Inconsistency Detection",
  severity: "low",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];

    // Group by parent (same heuristic as alignment-drift)
    const groups = new Map<string, DomSnapshot[]>();
    for (const el of snapshot) {
      const parentSelector = el.selector.replace(/\s*>[^>]+$/, "").trim() || "root";
      if (!groups.has(parentSelector)) groups.set(parentSelector, []);
      groups.get(parentSelector)!.push(el);
    }

    for (const siblings of groups.values()) {
      if (siblings.length < 3) continue;

      // Sort by vertical position
      const sorted = [...siblings].sort((a, b) => a.boundingBox.y - b.boundingBox.y);

      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        const gap = curr.boundingBox.y - (prev.boundingBox.y + prev.boundingBox.height);
        gaps.push(Math.max(0, gap));
      }

      const med = median(gaps);

      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i]!;
        if (Math.abs(gap - med) > 8) {
          const a = sorted[i]!;
          const b = sorted[i + 1]!;
          results.push({
            ruleId: "spacing-inconsistency",
            title: "Inconsistent spacing between elements",
            description: `Gap of ${gap}px between "${a.selector}" and "${b.selector}" deviates from median gap of ${med}px`,
            severity: "low",
            confidence: 0.7,
            evidence: [
              {
                domSelector: a.selector,
                computedValue: `gap: ${gap}px`,
                expectedValue: `gap: ~${med}px`,
                suggestedFix: `Adjust spacing between '${a.selector}' and '${b.selector}' to match the ${med}px rhythm. Use a consistent spacing scale (e.g. 4px, 8px, 16px) and apply via a design token or utility class.`,
              },
              {
                domSelector: b.selector,
                computedValue: `gap: ${gap}px`,
                expectedValue: `gap: ~${med}px`,
              },
            ],
          });
        }
      }
    }

    return results;
  },
};
