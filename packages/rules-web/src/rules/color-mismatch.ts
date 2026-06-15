import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-028 — Color Mismatch Detection
 *
 * Detects background or foreground colors that deviate significantly from the
 * dominant palette. Colors appearing on fewer than 2% of elements are flagged
 * unless they belong to button, a, or code tags.
 * Severity: low.
 */

// Tags whose unique colors are excluded from palette enforcement
const EXCLUDE_TAGS = new Set(["button", "a", "code"]);

export const colorMismatchRule: Rule = {
  id: "color-mismatch",
  name: "Color Mismatch Detection",
  severity: "low",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];
    const total = snapshot.length;
    if (total === 0) return results;

    // Build frequency map for colors
    const colorFreq = new Map<string, number>();
    for (const el of snapshot) {
      if (el.computedColor) {
        colorFreq.set(el.computedColor, (colorFreq.get(el.computedColor) ?? 0) + 1);
      }
      if (el.computedBackgroundColor) {
        colorFreq.set(
          el.computedBackgroundColor,
          (colorFreq.get(el.computedBackgroundColor) ?? 0) + 1
        );
      }
    }

    const threshold = total * 0.02; // 2% of elements

    // Allowed palette colors
    const allowList = new Set(
      [...colorFreq.entries()]
        .filter(([, count]) => count >= threshold)
        .map(([color]) => color)
    );

    for (const el of snapshot) {
      if (EXCLUDE_TAGS.has(el.tagName.toLowerCase())) continue;

      const colorOutlier = el.computedColor && !allowList.has(el.computedColor);
      const bgOutlier =
        el.computedBackgroundColor && !allowList.has(el.computedBackgroundColor);

      if (colorOutlier) {
        const frequency = colorFreq.get(el.computedColor) ?? 0;
        results.push({
          ruleId: "color-mismatch",
          title: "Off-palette foreground color",
          description: `Element "${el.selector}" uses color "${el.computedColor}" which appears on only ${frequency} element(s) (< 2% threshold)`,
          severity: "low",
          confidence: 0.65,
          evidence: [
            {
              domSelector: el.selector,
              computedValue: `color: ${el.computedColor} (frequency: ${frequency})`,
              expectedValue: `one of: ${[...allowList].slice(0, 5).join(", ")}`,
              suggestedFix: `Replace '${el.computedColor}' with a palette color from your design system. Consider using a CSS custom property (e.g. 'var(--color-text)') to enforce brand consistency.`,
            },
          ],
        });
      }

      if (bgOutlier) {
        const frequency = colorFreq.get(el.computedBackgroundColor) ?? 0;
        results.push({
          ruleId: "color-mismatch",
          title: "Off-palette background color",
          description: `Element "${el.selector}" uses background-color "${el.computedBackgroundColor}" which appears on only ${frequency} element(s)`,
          severity: "low",
          confidence: 0.65,
          evidence: [
            {
              domSelector: el.selector,
              computedValue: `background-color: ${el.computedBackgroundColor} (frequency: ${frequency})`,
              expectedValue: `one of: ${[...allowList].slice(0, 5).join(", ")}`,
              suggestedFix: `Replace background-color '${el.computedBackgroundColor}' with a palette token. Consider using a CSS custom property to enforce brand consistency.`,
            },
          ],
        });
      }
    }

    return results;
  },
};
