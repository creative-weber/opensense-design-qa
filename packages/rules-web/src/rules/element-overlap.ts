import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-024 — Element Overlap Detection
 *
 * Detects two non-sibling visible elements whose bounding boxes intersect unexpectedly.
 * Configurable allow-list suppresses known overlay patterns (tooltips, modals).
 * Severity: high when intersection area > 200px², medium otherwise.
 */

// Known overlay selectors that are intentionally overlapping
const ALLOW_LIST = [
  "[role=\"tooltip\"]",
  "[role=\"dialog\"]",
  "[role=\"menu\"]",
  ".modal",
  ".dropdown",
  ".popover",
  ".tooltip",
];

function intersectionArea(
  a: DomSnapshot["boundingBox"],
  b: DomSnapshot["boundingBox"]
): number {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return xOverlap * yOverlap;
}

function isAncestorOf(parent: DomSnapshot, child: DomSnapshot): boolean {
  return child.selector.startsWith(parent.selector);
}

/**
 * ODQA-024 — Element Overlap Detection
 */
export const elementOverlapRule: Rule = {
  id: "element-overlap",
  name: "Element Overlap Detection",
  severity: "high",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];

    for (let i = 0; i < snapshot.length; i++) {
      const a = snapshot[i]!;
      if (ALLOW_LIST.some((sel) => a.selector.includes(sel))) continue;

      for (let j = i + 1; j < snapshot.length; j++) {
        const b = snapshot[j]!;
        if (ALLOW_LIST.some((sel) => b.selector.includes(sel))) continue;
        if (isAncestorOf(a, b) || isAncestorOf(b, a)) continue;

        const area = intersectionArea(a.boundingBox, b.boundingBox);
        if (area <= 0) continue;

        const severity = area > 200 ? "high" : "medium";
        results.push({
          ruleId: "element-overlap",
          title: "Unexpected element overlap",
          description: `Elements "${a.selector}" and "${b.selector}" overlap by ${area}px²`,
          severity,
          confidence: 0.8,
          evidence: [
            {
              domSelector: a.selector,
              computedValue: `intersection area: ${area}px²`,
              expectedValue: "no intersection",
            },
            {
              domSelector: b.selector,
              computedValue: `intersection area: ${area}px²`,
              expectedValue: "no intersection",
            },
          ],
        });
      }
    }

    return results;
  },
};
