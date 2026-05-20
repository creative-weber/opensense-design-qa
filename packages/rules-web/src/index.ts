// Re-exports all built-in web rules
export { overflowClippingRule } from "./rules/overflow-clipping.ts";
export { elementOverlapRule } from "./rules/element-overlap.ts";
export { alignmentDriftRule } from "./rules/alignment-drift.ts";
export { spacingInconsistencyRule } from "./rules/spacing-inconsistency.ts";
export { typographyInconsistencyRule } from "./rules/typography-inconsistency.ts";
export { colorMismatchRule } from "./rules/color-mismatch.ts";
export { contrastWarningRule } from "./rules/contrast-warning.ts";

import { overflowClippingRule } from "./rules/overflow-clipping.ts";
import { elementOverlapRule } from "./rules/element-overlap.ts";
import { alignmentDriftRule } from "./rules/alignment-drift.ts";
import { spacingInconsistencyRule } from "./rules/spacing-inconsistency.ts";
import { typographyInconsistencyRule } from "./rules/typography-inconsistency.ts";
import { colorMismatchRule } from "./rules/color-mismatch.ts";
import { contrastWarningRule } from "./rules/contrast-warning.ts";

/** All built-in rules registered in execution order. */
export const ALL_RULES = [
  overflowClippingRule,
  elementOverlapRule,
  alignmentDriftRule,
  spacingInconsistencyRule,
  typographyInconsistencyRule,
  colorMismatchRule,
  contrastWarningRule,
];
