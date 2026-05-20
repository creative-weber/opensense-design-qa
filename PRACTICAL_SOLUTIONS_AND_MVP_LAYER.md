# OpenDesign-QA Practical Solutions Roadmap

Date: 2026-05-18

## Overview
This document provides a practical, solution-oriented roadmap for OpenDesign-QA, clearly separating MVP (Minimum Viable Product) features from next-level (differentiator/advanced) features. Each feature includes a concise description, customer value, and actionable implementation steps with codebase starting points.

---

## MVP Features (Phase 1)
These are the essential features required to deliver immediate value, enable real-world usage, and establish product credibility.

### 1. Dynamic Ignore Rules and Noise Controls
- **What:** Allow users to define selectors/regions to ignore dynamic elements (ads, carousels, timestamps) in visual checks.
- **Why:** Reduces false positives, increases trust, and speeds up review.
- **How:**
  - Add `POST/GET /api/runs/:runId/ignore-rules` endpoints ([apps/api/src/index.ts](apps/api/src/index.ts)).
  - Integrate ignore rule filtering before findings are returned ([apps/api/src/index.ts]).
  - Mark findings as ignored, not deleted, for audit traceability.
  - Use `CreateIgnoreRuleSchema` ([packages/contracts/src/schemas.ts]) and persist/query via DB package ([packages/db/src/index.ts]).

### 2. Worker Pipeline: Real Capture + Rules Execution
- **What:** Replace stubbed run simulation with real screenshot/DOM capture, rule execution, artifact storage, and run status updates.
- **Why:** Core to product credibility and production readiness.
- **How:**
  - Implement `capture()` with Playwright ([packages/capture/src/index.ts]).
  - In worker job, execute capture per viewport and call `runRules` ([apps/worker/src/index.ts]).
  - Upload artifacts and persist run/finding outcomes ([packages/storage/src/index.ts]).

### 3. PR-Ready Report Exports with Evidence Links
- **What:** Generate JSON/Markdown exports with summary, evidence links, and remediation hints.
- **Why:** Enables real PR workflows, client reporting, and audit trails.
- **How:**
  - Add `GET /api/runs/:runId/export?format=json|markdown` ([apps/api/src/index.ts]).
  - Include summary counts, evidence links, and next actions per finding.
  - Use `ExportFormatSchema` ([packages/contracts/src/schemas.ts]).

---

## Next-Level Features (Phase 2+)
These features differentiate OpenDesign-QA and deepen value for advanced teams.

### 4. Root-Cause Hints per Finding
- **What:** Enrich findings with probable cause (selector, style/layout diff, suggested fix).
- **Why:** Reduces time-to-fix and improves developer experience.
- **How:**
  - Standardize `additionalData` schema ([packages/contracts/src/schemas.ts]).
  - Add per-rule enrichers for root-cause hints ([packages/rules-core/src/index.ts]).
  - Render detail in run responses and exports ([apps/api/src/index.ts]).

### 5. Review Workflow and Decision Audit Trail
- **What:** Add reviewer actions (acknowledge, ignore, resolve) with reason/timestamp for each finding.
- **Why:** Enables accountable team workflow and exception documentation.
- **How:**
  - Add finding status fields and update endpoints ([apps/api/src/index.ts]).
  - Store action events per finding ([packages/db/src/index.ts]).
  - Surface status timeline in run detail and exports ([apps/web/src/components/NewAuditForm.tsx]).

### 6. Cross-Browser Capture Profiles
- **What:** Support capture across multiple browser engines (Chromium, Firefox, WebKit).
- **Why:** Increases confidence for mixed browser/device audiences.
- **How:**
  - Extend capture config/contracts for browser selection ([packages/capture/src/index.ts]).
  - Aggregate findings by browser/viewport ([apps/worker/src/index.ts], [apps/api/src/index.ts]).

### 7. Figma-to-Live Delta Normalization and Threshold Presets
- **What:** Add sensitivity presets and normalized delta scoring for layout/typography/color comparisons.
- **Why:** Improves signal quality and aligns with real defect criteria.
- **How:**
  - Introduce sensitivity presets at run creation ([apps/web/src/components/NewAuditForm.tsx]).
  - Apply tolerance thresholds by finding type ([packages/rules-core/src/index.ts]).
  - Expose score/threshold in finding evidence ([apps/api/src/index.ts]).

---

## Delivery Sequence
1. **MVP (Phase 1):**
   - Dynamic Ignore Rules and Noise Controls
   - Worker Pipeline: Real Capture + Rules Execution
   - PR-Ready Report Exports
2. **Next-Level (Phase 2+):**
   - Root-Cause Hints per Finding
   - Review Workflow and Decision Audit Trail
   - Cross-Browser Capture Profiles
   - Figma-to-Live Delta Normalization

---

## Notes
- Each feature above is mapped to a clear codebase starting point for rapid implementation.
- MVP features should be delivered first for immediate customer value and feedback.
- Next-level features can be layered on to drive differentiation and deeper adoption.
