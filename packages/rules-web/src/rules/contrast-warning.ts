import type { Rule, RuleResult } from "@opendesign-qa/rules-core";
import type { DomSnapshot } from "@opendesign-qa/capture";

/**
 * ODQA-029 — Contrast Warning Detection
 *
 * Detects text elements that fail the WCAG AA contrast ratio threshold.
 * Normal text: ratio < 4.5 → high severity
 * Large text (18px+): ratio < 3.0 → medium severity
 */

function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLargeText(fontSize: string): boolean {
  const px = parseFloat(fontSize);
  return !isNaN(px) && px >= 18;
}

const TEXT_TAGS = new Set(["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th", "label", "a", "button"]);

export const contrastWarningRule: Rule = {
  id: "contrast-warning",
  name: "Contrast Warning Detection",
  severity: "high",

  run(snapshot: DomSnapshot[]): RuleResult[] {
    const results: RuleResult[] = [];

    for (const el of snapshot) {
      if (!TEXT_TAGS.has(el.tagName.toLowerCase())) continue;

      const fg = parseRgb(el.computedColor);
      const bg = parseRgb(el.computedBackgroundColor);
      if (!fg || !bg) continue;

      const ratio = contrastRatio(fg, bg);
      const large = isLargeText(el.computedFontSize);

      const threshold = large ? 3.0 : 4.5;
      if (ratio >= threshold) continue;

      const severity = large ? "medium" : "high";

      results.push({
        ruleId: "contrast-warning",
        title: `Low contrast ratio on ${large ? "large" : "normal"} text`,
        description: `Element "${el.selector}" has a contrast ratio of ${ratio.toFixed(2)} which is below the WCAG AA threshold of ${threshold}`,
        severity,
        confidence: 0.95,
        evidence: [
          {
            domSelector: el.selector,
            computedValue: `contrast ratio: ${ratio.toFixed(2)} (fg: ${el.computedColor}, bg: ${el.computedBackgroundColor})`,
            expectedValue: `contrast ratio >= ${threshold}`,
          },
        ],
      });
    }

    return results;
  },
};
