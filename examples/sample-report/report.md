# OpenDesign QA — Audit Report

**Run ID:** run_sample_001
**Project:** proj_sample_001
**Audited URL:** https://example.com
**Status:** complete
**Created:** 2026-05-24T10:00:00.000Z

---

## Summary

| Severity | Count |
|----------|------:|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low | 2 |
| Info | 1 |
| **Total** | **8** |

---

## Top Blocking Findings

### 1. Insufficient colour contrast on CTA button
**Rule:** `contrast-warning` · **Severity:** high

The primary call-to-action button has a contrast ratio of 2.8:1, below the WCAG AA minimum of 4.5:1 for normal text.

**Evidence region:** `region:240,480,160,44`

**Recommended actions:**
- Increase button text colour darkness to achieve ≥ 4.5:1 ratio.
- Re-run audit after updating design tokens.

---

### 2. Navigation bar item missing from live page
**Rule:** `figma-diff/missing` · **Severity:** high

The 'Pricing' navigation link present in the Figma reference frame is absent from the rendered live page at desktop viewport (1280 × 800).

**Evidence region:** `region:560,12,80,28`

**Recommended actions:**
- Verify the navigation component renders all items from the data source.
- Check for conditional rendering that might hide the link.

---

### 3. Hero headline misaligned by 12 px
**Rule:** `alignment-drift` · **Severity:** medium

The H1 hero text has a left offset of 36 px instead of the expected 24 px, causing a 12 px horizontal drift from the grid baseline.

**Evidence region:** `region:0,120,800,72`

**Recommended actions:**
- Update margin-left on the hero container to match the 24 px grid baseline.
- Verify on both mobile and desktop viewports.

---

### 4. Inconsistent font size in card body text
**Rule:** `typography-inconsistency` · **Severity:** medium

Three feature cards use font-size 13 px while the design system specifies 14 px (body-sm). One card deviates to 12 px.

**Recommended actions:**
- Replace inline font-size overrides with the design-token class `text-body-sm`.

---

### 5. Inconsistent vertical gap between cards
**Rule:** `spacing-inconsistency` · **Severity:** medium

The gap between feature cards alternates between 16 px and 24 px. The Figma specification uses a uniform 24 px gap.

**Evidence region:** `region:0,380,1280,280`

**Recommended actions:**
- Set `gap: 24px` (or `gap-6` in Tailwind) on the cards grid container.

---

### 6. Footer background colour differs from Figma reference
**Rule:** `figma-diff/restyled` · **Severity:** low

The footer renders with #1a1a2e instead of the specified #0f0f1a, a brightness delta of 0.07.

**Evidence region:** `region:0,920,1280,160`

**Recommended actions:**
- Update `--color-footer-bg` CSS variable to #0f0f1a.

---

### 7. Social icon row shifted 8 px to the right
**Rule:** `figma-diff/misaligned` · **Severity:** low

The footer social-media icon row is positioned 8 px further right than in the Figma reference (mismatch ratio 3.2%).

**Evidence region:** `region:48,956,120,32`

**Recommended actions:**
- Remove the `pl-2` override on `.social-icons` and rely on the parent flex container's padding.

---

### 8. Cookie banner text overflows container on mobile
**Rule:** `overflow-clipping` · **Severity:** info

At the 375 × 812 (iPhone SE) viewport the cookie-consent banner body text clips at the right edge by approximately 6 px.

**Evidence region:** `region:0,768,375,44`

**Recommended actions:**
- Add `overflow-wrap: break-word` and right padding to the cookie banner text container.

---

## Artifacts

| Type | Storage Key |
|------|-------------|
| screenshot | `runs/run_sample_001/viewports/desktop/screenshot.png` |
| screenshot | `runs/run_sample_001/viewports/mobile/screenshot.png` |
| figma_frame | `runs/run_sample_001/figma/frame.png` |
| diff_image | `runs/run_sample_001/viewports/desktop/diff.png` |
| dom_metadata | `runs/run_sample_001/viewports/desktop/dom.json` |
