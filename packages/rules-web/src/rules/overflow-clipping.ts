import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-023 — Overflow And Clipping Detection
 *
 * Detects elements where scrollWidth > clientWidth or scrollHeight > clientHeight.
 * Severity: high when overflow > 20px, medium otherwise.
 */
export const overflowClippingRule: Rule = {
  id: "overflow-clipping",
  name: "Overflow And Clipping Detection",
  severity: "high",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];

    for (const element of snapshot) {
      const xOverflow = element.scrollWidth - element.clientWidth;
      const yOverflow = element.scrollHeight - element.clientHeight;

      if (xOverflow <= 0 && yOverflow <= 0) continue;

      // Skip intentional overflow containers
      if (element.overflow === "auto" || element.overflow === "scroll") continue;

      const overflowPx = Math.max(xOverflow, yOverflow);
      const severity = overflowPx > 20 ? "high" : "medium";
      const axis = xOverflow > 0 && yOverflow > 0
        ? "both"
        : xOverflow > 0
        ? "horizontal"
        : "vertical";

      results.push({
        ruleId: "overflow-clipping",
        title: "Content overflow detected",
        description: `Element overflows its container on the ${axis} axis by ${overflowPx}px`,
        severity,
        confidence: 0.9,
        evidence: [
          {
            domSelector: element.selector,
            computedValue: `overflow: ${element.overflow}; scrollWidth: ${element.scrollWidth}; clientWidth: ${element.clientWidth}`,
            expectedValue: "no overflow",
            suggestedFix: `Add 'overflow: hidden' or 'overflow: auto' to ${element.selector}, or constrain its width/height. Check for content that exceeds the container bounds.`,
          },
        ],
      });
    }

    return results;
  },
};
