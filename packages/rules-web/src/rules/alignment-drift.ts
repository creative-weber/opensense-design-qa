import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-025 — Alignment Drift Detection
 *
 * Detects elements in a visible list or grid that are misaligned relative to
 * their peers. Groups visible sibling elements and checks left-edge alignment
 * variance. Groups of fewer than 2 elements are skipped. Severity: medium.
 */
export const alignmentDriftRule: Rule = {
  id: "alignment-drift",
  name: "Alignment Drift Detection",
  severity: "medium",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];

    // Group elements by their parent selector (heuristic: strip last segment)
    const groups = new Map<string, DomSnapshot[]>();
    for (const el of snapshot) {
      const parentSelector = el.selector.replace(/\s*>[^>]+$/, "").trim() || "root";
      if (!groups.has(parentSelector)) groups.set(parentSelector, []);
      groups.get(parentSelector)!.push(el);
    }

    for (const [groupSelector, siblings] of groups) {
      if (siblings.length < 2) continue;

      const lefts = siblings.map((s) => s.boundingBox.x);
      const dominantLeft = lefts.sort((a, b) =>
        lefts.filter((v) => v === b).length - lefts.filter((v) => v === a).length
      )[0]!;

      for (const el of siblings) {
        const drift = Math.abs(el.boundingBox.x - dominantLeft);
        if (drift > 2) {
          results.push({
            ruleId: "alignment-drift",
            title: "Alignment drift detected",
            description: `Element "${el.selector}" is misaligned by ${drift}px within group "${groupSelector}"`,
            severity: "medium",
            confidence: 0.75,
            evidence: [
              {
                domSelector: el.selector,
                computedValue: `left: ${el.boundingBox.x}px`,
                expectedValue: `left: ${dominantLeft}px`,
                suggestedFix: `Align '${el.selector}' to ${dominantLeft}px left (${drift}px drift). Check for missing 'margin-left: 0', inconsistent padding, or a flex/grid alignment override.`,
              },
            ],
          });
        }
      }
    }

    return results;
  },
};
