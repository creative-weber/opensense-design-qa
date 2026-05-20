# OpenDesign-QA Most Valuable Features, Sorted by Implementation Order

Date: 2026-05-18
Source: Derived from the prioritized feature section in COMPETITOR_ANALYSIS_AND_SCORECARD.md.

## How to read this document

The list is sorted by implementation order, not just customer value.

Order logic:
1. Build the core audit pipeline first.
2. Add trust and signal-quality controls next.
3. Add customer-facing reporting and workflow features.
4. Finish with deeper fidelity and collaboration improvements.

## 1) Worker Pipeline: Real Capture + Rules Execution

Feature summary:
- Replace stubbed run simulation with actual queued execution: capture screenshots and DOM snapshots, run rules, store artifacts and findings, and update run status.

Why it matters to customers:
- This is the core product promise.
- Without real execution, the platform cannot produce credible audits.
- It unlocks every later feature in the roadmap.

Starting point in the codebase:
- `apps/worker/src/index.ts`
- `packages/capture/src/index.ts`
- `packages/rules-core/src/index.ts`
- `packages/storage/src/index.ts`

Suggested first step:
1. Implement `capture()` using Playwright and the built-in viewport presets.
2. Wire `processAuditJob()` to call capture, run rules, and persist the results.

## 2) Dynamic Ignore Rules and Noise Controls

Feature summary:
- Let users ignore known dynamic elements by selector, region, or rule so visual checks stay stable and actionable.

Why it matters to customers:
- Cuts false positives and alert fatigue.
- Improves trust in the product immediately.
- Makes audits usable in real projects with dynamic content.

Starting point in the codebase:
- `packages/contracts/src/schemas.ts`
- `apps/api/src/index.ts`
- `packages/db/src/index.ts`

Suggested first step:
1. Add ignore-rule endpoints.
2. Apply ignore rules before findings are returned or exported.

## 3) PR-Ready Report Exports with Evidence Links

Feature summary:
- Generate JSON and Markdown exports with severity summary, viewport context, evidence links, and remediation hints.

Why it matters to customers:
- Makes audit output usable in pull requests, client reports, and stakeholder reviews.
- Helps agencies and QA teams share findings without extra manual formatting.
- Creates a portable audit trail.

Starting point in the codebase:
- `packages/contracts/src/schemas.ts`
- `apps/api/src/index.ts`

Suggested first step:
1. Add an export endpoint for JSON and Markdown.
2. Include summary counts and direct evidence URLs.

## 4) Root-Cause Hints per Finding

Feature summary:
- Enrich findings with probable cause context such as selector, computed versus expected style, likely source class or token, and suggested fix steps.

Why it matters to customers:
- Reduces time-to-fix.
- Gives developers something actionable instead of a raw diff.
- Improves trust and usability of the report.

Starting point in the codebase:
- `packages/contracts/src/schemas.ts`
- `packages/rules-core/src/index.ts`
- `apps/api/src/index.ts`

Suggested first step:
1. Standardize the extra diagnostics payload.
2. Add enrichers per rule to attach fix guidance.

## 5) Review Workflow and Decision Audit Trail

Feature summary:
- Add reviewer actions on findings such as open, acknowledged, ignored, and resolved, with reason and timestamp.

Why it matters to customers:
- Turns analysis into a team workflow.
- Helps document why exceptions were accepted.
- Fits agencies and enterprise teams especially well.

Starting point in the codebase:
- `apps/api/src/index.ts`
- `packages/db/src/index.ts`
- `apps/web/src/components/NewAuditForm.tsx`

Suggested first step:
1. Add finding status fields and update endpoints.
2. Store action history per finding.

## 6) Cross-Browser Capture Profiles

Feature summary:
- Support capture across browser engines and expose reusable capture profiles.

Why it matters to customers:
- Cross-browser regressions are common and expensive.
- Strengthens competitive parity with leading visual-testing platforms.
- Improves confidence for teams shipping to mixed browser audiences.

Starting point in the codebase:
- `packages/capture/src/index.ts`
- `apps/web/src/components/NewAuditForm.tsx`
- `packages/contracts/src/schemas.ts`
- `apps/worker/src/index.ts`

Suggested first step:
1. Extend the capture contract with browser engine selection.
2. Add Chromium first, then WebKit and Firefox.

## 7) Figma-to-Live Delta Normalization and Threshold Presets

Feature summary:
- Add sensitivity presets and normalized delta scoring for layout, typography, and color comparisons.

Why it matters to customers:
- Makes Figma comparison less brittle.
- Improves signal quality when small rendering differences are acceptable.
- Helps the product better match how design teams judge real defects.

Starting point in the codebase:
- `apps/api/src/index.ts`
- `apps/web/docs/test-landing-figma-spec.md`
- `packages/capture/src/index.ts`

Suggested first step:
1. Add low, medium, and high sensitivity presets.
2. Apply tolerance thresholds by finding type.

## Recommended implementation sequence

1. Worker pipeline: real capture + rules execution
2. Dynamic ignore rules and noise controls
3. PR-ready report exports with evidence links
4. Root-cause hints per finding
5. Review workflow and decision audit trail
6. Cross-browser capture profiles
7. Figma-to-live delta normalization and threshold presets

## Why this order works

- The first item creates a functioning product.
- The next two increase trust and make the output usable.
- The middle items make the product easier to act on and collaborate around.
- The last two improve fidelity and competitive depth after the core workflow is stable.
