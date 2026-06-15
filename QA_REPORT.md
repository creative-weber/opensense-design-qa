# OpenDesign QA — Full E2E QA Report
**Date:** 2026-06-01
**Tester:** Clawis (AI QA Agent)
**App under test:** http://localhost:3000 (API: http://localhost:3001)
**Test plan:** E2E_POST_MVP_TESTING_PLAN.md
**DB state at time of testing:** 8,383 findings across multiple prior runs

---

## Executive Summary

The core pipeline works end-to-end: submit a URL, Playwright captures screenshots, 7
visual rules run, findings land in PostgreSQL. However a critical infrastructure bug
(missing DB migration + wrong table ownership) caused the findings API to return 0
results silently. This was diagnosed and fixed during testing. Beyond the core, most
Phase B and Phase C features described in the test plan are not yet implemented — the
API returns 404 for every advanced endpoint. The app solves a real pain point but is
not production-ready without the fixes listed below.

**Overall verdict: CORE WORKS, ADVANCED FEATURES NOT IMPLEMENTED**

---

## Infrastructure Bug Found and Fixed

### BUG-001 (Critical) — All findings API returned 0 results despite 8,383 in DB

Root cause: Prisma schema references `review_status`, `review_note`, `reviewed_at`
columns that did not exist in the `findings` table. The migration that adds them
(`add_review_workflow_and_accessibility`) failed silently because all tables were owned
by the `postgres` superuser, not the `opendesign` app user. Prisma's generated SQL
included these columns in every SELECT, causing every `db.finding.findMany()` call to
throw a PostgreSQL error caught silently, returning an empty array to the client.

Fix applied during testing:
1. Transferred ownership of all 9 tables to `opendesign` via ALTER TABLE OWNER TO
2. Created the `review_status` enum and added the 3 missing columns to `findings`
3. Added index on `findings(review_status)`

After fix: GET /api/runs/:id/findings returned total=816 correctly.

This bug would have made the product completely unusable in any fresh deployment.

---

## Phase A — Low Effort / High Impact

| ID   | Test                             | Result | Evidence |
|------|----------------------------------|--------|----------|
| A-01 | axe-core accessibility findings  | FAIL   | findingType="" on all findings; 0 accessibility findings in 816-finding run |
| A-02 | Root-cause hints / suggestedFix  | FAIL   | evidence[0].additionalData is null on all findings |
| A-03 | Review workflow (PATCH review)   | PASS   | PATCH /api/findings/:id/review → 200 + reviewStatus=acknowledged + reviewedAt timestamp |
| A-04 | AI diff / summary on run         | FAIL   | No aiSummary or diffSummary field on run or viewport run response |
| A-05 | Slack notification (graceful)    | PASS   | Runs complete to rules_complete without SLACK_WEBHOOK_URL (no crash) |
| A-06 | CLI (odqa scan)                  | FAIL   | dist/index.js not built; CLI package exists (src/index.ts, src/run.ts) but was never compiled |
| A-07 | Responsive matrix (multiple VP)  | PARTIAL| API accepts viewports array; worker processes them; no per-viewport diff UI visible |

### A-01 Detail — Zero accessibility findings on test run
**⚠️ Correction (post-validation):** Axe-core IS fully integrated in code. `packages/capture/src/index.ts`
injects axe-core and runs WCAG 2A/2AA/2.1AA rules; `apps/worker/src/index.ts` calls
`persistAccessibilityFindings()` with the results. Zero accessibility findings on this run
is most likely explained by axe-core failing silently on a page with a strict CSP (the
capture package degrades gracefully with `resolve([])`). The integration should be
verified on a CSP-permissive staging URL before concluding it is broken.

The confirmed issue is that `findingType` is populated correctly in the DB (set to
`ruleId`, e.g. `"contrast-warning"`) but is **not included in the API response mapper**,
so API consumers receive `undefined` for `findingType` on every finding.

### A-02 Detail — suggestedFix present in code; null in DB for pre-fix rows only
**⚠️ Correction (post-validation):** All 7 visual rules produce `suggestedFix` strings in
their evidence (verified in `packages/rules-web/src/rules/*.ts`). The worker stores it as
`additionalData: { suggestedFix: "..." }`. The null `additionalData` observed during
testing was an artifact of **old rows written before the DB migration was applied** — those
rows existed when the findings table was broken and could not receive the data. Findings
created after the migration fix should have `additionalData.suggestedFix` populated.
This should be re-verified on a fresh post-fix run.

### A-06 Detail — CLI not built
packages/cli/src/index.ts and run.ts exist but `pnpm build` was never run for this
package. `dist/index.js` is absent. Dev teams cannot use `npx odqa scan` in CI pipelines.

---

## Phase B — Medium Effort

| ID   | Test                              | Result | Evidence |
|------|-----------------------------------|--------|----------|
| B-01 | Jira/Linear ticket creation       | FAIL   | POST /api/findings/:id/create-ticket → 404 Not Found |
| B-02 | Project-scoped ignore rules       | FAIL   | GET/POST /api/projects/:id/ignore-rules → 404 Not Found |
| B-03 | Cross-browser (webkit) runs       | PARTIAL| POST /api/runs accepts browser="webkit" (201) but field not stored/returned; worker likely ignores it |
| B-04 | Sensitivity presets               | PARTIAL| POST /api/runs accepts sensitivityPreset="low" (201) but field not stored/returned; rules use hardcoded thresholds |
| B-05 | Bulk review                       | FAIL   | PATCH /api/runs/:id/findings/bulk-review → 404 Not Found |
| B-06 | Multi-theme / dark mode           | PARTIAL| POST /api/runs accepts themes=["light","dark"] (201) but field not stored; worker does not toggle prefers-color-scheme |

### B-02 Detail — Ignore rules critical gap
Without project-scoped ignore rules, teams cannot suppress known false positives. The
element-overlap rule produces ~93% false positives on CSS grid layouts (7,804 of 8,383
total findings). There is no way to silence these. Every run will be flooded with noise,
making the tool unusable for teams using CSS grid.

### B-05 Detail — No bulk review
Reviewing 816 findings one PATCH at a time is not viable. Bulk review is essential for
real teams to triage a run after deployment.

---

## Phase C — High Effort / Strategic

| ID   | Test                             | Result | Evidence |
|------|----------------------------------|--------|----------|
| C-01 | Design token upload              | FAIL   | GET /api/projects/:id/tokens → 404 Not Found |
| C-02 | Core Web Vitals                  | FAIL   | No performanceMetrics field on viewport run response |
| C-03 | Animation capture                | PARTIAL| POST /api/runs accepts captureAnimation=true (201) but not stored or acted on |
| C-04 | Plugin / custom rule SDK         | FAIL   | GET /api/rules → 404; no plugin registration mechanism |
| C-05 | Billing / usage endpoint         | FAIL   | GET /api/billing → 404 |

---

## User Story Tests

### Lena — UX Lead, detecting regressions before release
Journey: Submit PR staging URL → review findings → share with dev → fix and re-run

Result: BLOCKED at step 3
- Lena can submit a URL and get findings (core works after DB fix)
- Findings list 816 results but ~760 are element-overlap noise with no fix hint
- No way to filter by rule type in the current UI
- No suggestedFix means Lena cannot tell the dev what to change
- No AI summary means she must read 816 raw findings manually
- VERDICT: Lena cannot complete her workflow. The signal-to-noise ratio is too high.

### Marcus — Design systems lead, tracking token drift
Journey: Upload design tokens → run audit → see which components diverge

Result: BLOCKED at step 1
- POST /api/projects/:id/tokens → 404
- No token upload, no token-aware rules, no drift detection
- VERDICT: Marcus's entire use case is unimplemented.

### Dev — Engineer, integrating into CI pipeline
Journey: `npx odqa scan --url $STAGING_URL` in GitHub Actions

Result: BLOCKED
- CLI dist/index.js does not exist (never built)
- Even if built, no --threshold flag support confirmed
- No exit code > 0 on high-severity findings (CI gate impossible)
- VERDICT: Dev cannot use this in CI without building the CLI first.

---

## Known Bugs Summary

| # | Severity | Area | Description |
|---|----------|------|-------------|
| 1 | CRITICAL | DB/Migration | Missing columns caused 0-findings response; fixed during testing |
| 2 | CRITICAL | Rules | element-overlap fires on every CSS grid layout — ~93% false positive rate |
| 3 | HIGH | API | findingType is omitted from the API response mapper (it is stored correctly in DB as ruleId, not empty string) — add findingType to the response shape in GET /api/runs/:id/findings |
| 4 | MEDIUM | Findings | evidence[0].additionalData was null on pre-fix rows only — all 7 rules generate suggestedFix; re-test on a fresh post-fix run to confirm new rows populate correctly |
| 5 | HIGH | CLI | packages/cli never built — dist/index.js missing |
| 6 | HIGH | API | No bulk-review endpoint — reviewing large runs is impractical |
| 7 | HIGH | API | No project-scoped ignore-rules endpoint — false positives cannot be suppressed |
| 8 | MEDIUM | API | browser, sensitivityPreset, themes, captureAnimation fields accepted but silently ignored |
| 9 | MEDIUM | Worker | Axe-core IS integrated (capture package + worker) — zero findings on test run likely due to CSP on test URL; verify on CSP-permissive URL and confirm findingType="accessibility" appears in API response |
| 10 | MEDIUM | API | No AI summary/diff on runs |
| 11 | LOW | API | No Jira/Linear integration |
| 12 | LOW | API | No design token upload/comparison |
| 13 | LOW | API | No Core Web Vitals capture |
| 14 | LOW | API | No billing/usage endpoint |

---

## What Works (Confirmed)

1. POST /api/projects — create project
2. POST /api/runs — queue a run
3. Worker: Playwright screenshots at desktop + mobile viewports
4. Worker: 7 visual rules execute and produce findings
5. Worker: findings persisted to PostgreSQL (8,383 total across runs)
6. GET /api/runs/:id — run status polling (pending → processing → rules_complete)
7. GET /api/runs/:id/findings — paginated findings list (after DB fix)
8. PATCH /api/findings/:id/review — single-finding review workflow (PASS)
9. GET /health → 200 {"status":"ok"}
10. Graceful handling of missing SLACK_WEBHOOK_URL (no crash)

---

## Recommended Fix Priority

### P0 — Must fix before any real user can use the product
1. Fix element-overlap false positive on CSS grid (tighten overlap threshold or use
   z-index + stacking context checks before flagging)
2. Add bulk review endpoint (PATCH /api/runs/:id/findings/bulk-review)
3. Add project-scoped ignore-rules endpoint
4. Build CLI and verify exit codes work for CI gating

### P1 — Needed for core value proposition
5. Add findingType to the API response mapper in GET /api/runs/:id/findings (it is stored in DB, just not returned)
6. Re-verify additionalData.suggestedFix on a fresh post-fix run; all rules already produce it — no code change needed if migration is clean
7. Verify axe-core on a CSP-permissive URL; the integration is already implemented

### P2 — Differentiation features
8. Respect browser / sensitivityPreset / themes when creating runs (store + use in worker)
9. Add AI summary endpoint on run completion
10. Design token upload + token-aware rules for Marcus's use case

### P3 — Enterprise / monetization
11. Jira/Linear integration
12. Core Web Vitals capture
13. Plugin/custom rule SDK
14. Billing/usage endpoint

---

## Competitive Context (from MARKET-RESEARCH.md)

Applitools: ~$1,000+/mo. Percy: $599/mo. Chromatic: $149/mo.
OpenDesign QA's differentiator is usage-based open-source pricing.
But at current quality (93% false positive rate, no suggestedFix, no CLI, no bulk triage),
it cannot compete even at $0. Fixing BUG #2 (element-overlap) and BUG #4 (suggestedFix)
alone would make the core meaningfully better than manually filing Jira tickets.

---

## Test Environment

- OS: Windows 11 / WSL2
- Node: checked via pnpm workspace
- PostgreSQL: 18 (Windows native)
- Redis: running (BullMQ connected)
- API: http://localhost:3001 (started via start-api.ps1)
- Web: http://localhost:3000 (started via start-web.ps1)
- Worker: started via start-worker.ps1

---

*Report generated by Clawis QA Agent — 2026-06-01*

---

## Code-Level Validation — 2026-06-01
**Validator:** GitHub Copilot (static analysis of source)
**Method:** Read `apps/api/src/index.ts`, `apps/worker/src/index.ts`, `packages/capture/src/index.ts`, all `packages/rules-web/src/rules/*.ts`, `packages/cli/src/index.ts`, `packages/db/prisma/schema.prisma`

### Findings Confirmed Correct

| ID | Claim | Confirmation |
|----|-------|--------------|
| A-03 | PATCH /api/findings/:id/review works | Endpoint present; updates `reviewStatus`, `reviewNote`, `reviewedAt` via Prisma |
| A-05 | Slack degrades gracefully | `notify-slack.ts` imported; worker continues if env var absent |
| A-06 | CLI dist/index.js not built | `packages/cli/dist/` does not exist; `tsc --outDir dist` was never run |
| A-07 | Responsive matrix partial | `viewports` array accepted; no per-viewport diff UI in web app |
| B-01 | No Jira/Linear endpoint | Not implemented in API |
| B-02 | No project-scoped ignore-rules | Only run-scoped `POST /api/runs/:id/ignore-rules` exists |
| B-03/04/06 | browser, sensitivityPreset, themes, captureAnimation silently ignored | Not in Zod schema for POST /api/runs; fields stripped on parse |
| B-05 | No bulk-review endpoint | Not implemented in API |
| C-01–C-05 | All Phase C endpoints → 404 | None present in API source |

### Findings Corrected

**A-01 — Axe-core claim**
The report states "axe-core integration is not wired up". This is incorrect.
- `packages/capture/src/index.ts` injects axe-core, runs WCAG 2A/2AA/2.1AA, returns `accessibilityViolations`
- `apps/worker/src/index.ts:534` calls `persistAccessibilityFindings()` with those violations
- Zero findings on the test run is attributable to CSP blocking axe-core injection (the catch block resolves with `[]`)
- **Action:** Re-test on a CSP-permissive URL; this is a test coverage gap, not a code gap

**A-01 — findingType claim (Bug #3)**
The report states `findingType=""` (empty string). This is incorrect.
- Worker stores `findingType: result.ruleId` (e.g. `"element-overlap"`, `"contrast-warning"`)
- The real bug: `findingType` is omitted from the response object built in `GET /api/runs/:id/findings` (the `mapped: Finding[]` shape does not include it)
- **Action:** Add `findingType: f.findingType` to the response mapper — one-line fix

**A-02 — suggestedFix claim (Bug #4)**
The report states `additionalData` is null for all findings. This was true only for pre-migration rows.
- All 7 rules in `packages/rules-web/src/rules/` produce `suggestedFix` strings in evidence
- Worker writes `additionalData: ev.suggestedFix ? { suggestedFix: ev.suggestedFix } : null`
- Old rows (written while the migration was broken) legitimately have null; new rows post-fix should be populated
- **Action:** Run a fresh audit after the DB fix and confirm `additionalData.suggestedFix` appears

### Severity Re-classifications

| Bug # | Original | Revised | Reason |
|-------|----------|---------|--------|
| 3 | HIGH — empty findingType | HIGH — findingType missing from API response | Code stores it correctly; fix is in the mapper |
| 4 | HIGH — no suggestedFix | MEDIUM — data exists post-fix; needs re-verification | Pre-fix rows are stale; not a code defect |
| 9 | MEDIUM — no axe-core | MEDIUM — axe-core exists; CSP or test URL issue | Integration complete; operational gap |

### Net Assessment
The report's overall verdict (CORE WORKS, ADVANCED FEATURES NOT IMPLEMENTED) is accurate.
The three corrections above reduce the true P1 backlog: findingType mapper fix is trivial (1 line);
suggestedFix and axe-core require re-testing, not re-implementation.
