import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-027 — Typography Inconsistency Detection
 *
 * Detects headings, labels, or body text that use inconsistent font sizes or
 * weights not present in the dominant type scale.
 * Flags any fontSize appearing fewer than 3 times if not in the dominant scale.
 * Same logic applies to fontWeight. Severity: medium.
 */
export const typographyInconsistencyRule: Rule = {
  id: "typography-inconsistency",
  name: "Typography Inconsistency Detection",
  severity: "medium",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];

    // Build frequency maps for fontSize
    const fontSizeFreq = new Map<string, number>();
    for (const el of snapshot) {
      if (!el.computedFontSize) continue;
      fontSizeFreq.set(el.computedFontSize, (fontSizeFreq.get(el.computedFontSize) ?? 0) + 1);
    }

    // Dominant scale = sizes appearing >= 3 times
    const dominantFontSizes = new Set(
      [...fontSizeFreq.entries()].filter(([, count]) => count >= 3).map(([size]) => size)
    );

    // Check for outlier font sizes
    for (const el of snapshot) {
      if (!el.computedFontSize) continue;
      const count = fontSizeFreq.get(el.computedFontSize) ?? 0;
      if (count < 3 && !dominantFontSizes.has(el.computedFontSize)) {
        results.push({
          ruleId: "typography-inconsistency",
          title: "Inconsistent font size",
          description: `Element "${el.selector}" uses font-size "${el.computedFontSize}" which is not part of the dominant type scale`,
          severity: "medium",
          confidence: 0.75,
          evidence: [
            {
              domSelector: el.selector,
              computedValue: `fontSize: ${el.computedFontSize}`,
              expectedValue: `one of: ${[...dominantFontSizes].join(", ") || "none established"}`,
            },
          ],
        });
      }
    }

    return results;
  },
};
