# OpenDesign QA — Post-MVP Feature Backlog

> Source: MARKET-RESEARCH.md, IMPLEMENTATION_PRIORITY_FEATURES.md, OSS_DESIGN_QA_ROADMAP.md
> Status key: ⬜ Not started | 🔧 In progress | ✅ Completed

---

## Market Gap Summary

No competitor has all of the following. These are the white spaces:

| Gap | Competitive Coverage |
|-----|---------------------|
| Figma-to-browser comparison | Almost completely absent |
| Built-in accessibility overlay | Zero competitors |
| AI plain-English diff summary | Only Applitools partial |
| Slack/Teams approval workflow | Mostly absent |
| Design token validation | Absent everywhere |
| Linear/Jira bug creation | Manual in every tool |
| Multi-theme / dark mode testing | Absent everywhere |
| Animation / motion regression | Absent everywhere |

---

## Phase A — Low Effort / High Impact (quick wins)

These features ship fast, directly address user pain points, and create the biggest competitive delta.

| # | Feature | Effort | Market Priority | Status |
|---|---------|--------|-----------------|--------|
| A-01 | **Built-in Accessibility Overlay (axe-core)** | Low | Tier 1 | ✅ |
| A-02 | **Root-Cause Hints Per Finding** | Low | Tier 1 | ✅ |
| A-03 | **Finding Review Workflow** (open / acknowledged / resolved) | Low | Tier 2 | ✅ |
| A-04 | **AI Plain-English Diff Summary** | Low | Tier 1 | ⬜ |
| A-05 | **Slack Approval Workflow** | Low | Tier 2 | ✅ |
| A-06 | **CLI** (`@opendesign-qa/cli`) | Low | Phase 3 Roadmap | ✅ |
| A-07 | **Responsive Breakpoint Matrix View** | Low | Tier 3 | ⬜ |

### A-01 — Built-in Accessibility Overlay (axe-core)

**What:** Run `axe-core` alongside every Playwright capture. Overlay WCAG violations on the diff image. Report WCAG 2.1 level A/AA failures inline with visual findings.

**Why:** No competitor has this. Legal compliance (ADA/WCAG) is a direct sales accelerator. It piggybacks on existing Playwright sessions — zero extra run cost.

**Implementation:**
- Add `axe-core` to `packages/capture`
- After screenshot capture, inject axe source into the page and call `axe.run()`
- Return `accessibilityViolations[]` from `capture()`
- Worker converts each violation to a `Finding` with `findingType = "accessibility"` and maps impact → severity
- Add `accessibility` to `findingType` enum in contracts

**Sell to:** Enterprise under ADA/WCAG compliance, fintech, healthcare, government.

---

### A-02 — Root-Cause Hints Per Finding

**What:** Enrich each finding with a `suggestedFix` (stored in `FindingEvidence.additionalData`). All 7 web rules get concrete fix guidance so developers know exactly what to change.

**Why:** Reduces time-to-fix. Gives developers something actionable. Improves trust and usability.

**Implementation:**
- Extend `Evidence` interface in `rules-core` with optional `suggestedFix?: string`
- Update all 7 web rules to include a `suggestedFix` in evidence `additionalData`
- No DB schema migration required (uses existing `additionalData` JSON column)

---

### A-03 — Finding Review Workflow

**What:** Add reviewer actions on findings: `open` → `acknowledged` → `resolved` / `ignored`, with a note and timestamp. This turns analysis into a team workflow.

**Why:** Helps document exceptions, fits agencies and enterprise teams. Item #5 in IMPLEMENTATION_PRIORITY_FEATURES.md.

**Implementation:**
- Add `ReviewStatus` enum to Prisma schema (`open`, `acknowledged`, `ignored`, `resolved`)
- Add `reviewStatus`, `reviewNote`, `reviewedAt` fields to `Finding` model
- New Prisma migration
- Add `PATCH /api/findings/:id/review` endpoint to the API
- Add `ReviewFindingSchema` to contracts

---

### A-04 — AI Plain-English Diff Summary

**What:** Use an LLM vision model to describe what changed in every visual diff in natural language. Example: *"Primary button color shifted from blue-500 to blue-600. Card header spacing increased by 4px."*

**Why:** Only Applitools has a partial version. Nobody explains diffs in natural language. Designers/PMs can approve without being engineers.

**Implementation:**
- Store `aiSummary?: string` in `FigmaReference.metadataJson` or a new column
- After `generateComparisonFindings()`, call LLM vision API (OpenAI/Anthropic) with the diff image buffer
- Write summary back to `AuditRun` or `FigmaReference`
- Show AI summary in comparison viewer UI
- Requires: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` env var (optional; skipped when absent)

---

### A-05 — Slack Approval Workflow

**What:** After a run completes, POST a summary (finding counts, severity breakdown, top issues) to a configurable Slack webhook. No competitor has this today.

**Why:** Zero context switching. Teams already live in Slack. Highest-demand missing integration.

**Implementation:**
- Add `SLACK_WEBHOOK_URL` env var
- Worker posts a rich Slack message (blocks API) after `processAuditJob` completes
- Message includes: run URL, severity counts, top 3 findings with evidence, "View Report" button
- `packages/notify` package or inline in worker

---

### A-06 — CLI (`@opendesign-qa/cli`)

**What:** `opendesign-qa run <url>` — submit an audit, poll for results, print a summary, and optionally save the report as JSON/MD.

**Why:** Phase 3 roadmap item. Makes the tool practical in CI and local review workflows.

**Implementation:**
- New `packages/cli` workspace package
- Uses `commander` for argument parsing
- Calls the REST API, polls `/api/runs/:id` until terminal status, prints results
- Supports `--viewport`, `--figma`, `--output` flags
- Output: colored terminal summary + optional `--output report.json`

---

### A-07 — Responsive Breakpoint Matrix View

**What:** One run matrix view showing all viewports (mobile/tablet/desktop) side-by-side. "Already partially built" per market research — viewport multi-select already works.

**Why:** Low effort, already partially supported. Every team needs this.

**Implementation:**
- Add a `/runs/:id/matrix` page in the web app
- Grid showing per-viewport screenshots side-by-side
- Highlight viewport-specific findings inline

---

## Phase B — Medium Effort

| # | Feature | Effort | Market Priority | Status |
|---|---------|--------|-----------------|--------|
| B-01 | **Jira / Linear Bug Creation** | Medium | Tier 2 | ⬜ |
| B-02 | **Dynamic Ignore Rules & Noise Controls** | Medium | Phase 3 Roadmap | ⬜ |
| B-03 | **Cross-Browser Capture Profiles** (WebKit, Firefox) | Medium | Phase 3 | ⬜ |
| B-04 | **Figma-to-Live Delta Normalization & Threshold Presets** | Medium | Phase 3 | ⬜ |
| B-05 | **Smart Batch Approval with AI Categorization** | Medium | Tier 2 | ⬜ |
| B-06 | **Multi-Theme / Dark Mode Native Support** | Medium | Tier 2 | ⬜ |

### B-01 — Jira / Linear Bug Creation

**What:** One-click create ticket from any finding. Pre-fill: screenshot, before/after comparison, component selector, PR link, rule violated.

**Why:** 100% manual today in every competing tool. Linear targets fast-growing startup segment.

**Implementation:**
- Add `POST /api/findings/:id/create-ticket` endpoint
- Support `provider: "jira" | "linear"` in request body
- Jira: REST API v3 with basic auth / API token
- Linear: GraphQL API with personal API key
- Store `externalTicketUrl` on the Finding row

---

### B-02 — Dynamic Ignore Rules & Noise Controls

**What:** Let users ignore known dynamic elements by CSS selector, bounding-box region, or rule ID so audits stay stable on pages with carousels, ads, timestamps, etc.

**Why:** Top pain point — "false positives". Cuts alert fatigue. Listed as priority #2 in IMPLEMENTATION_PRIORITY_FEATURES.md.

**Implementation:**
- `IgnoreRule` model already exists in DB schema
- Wire `POST /api/runs/:id/ignore-rules` (already stubbed in API)
- Worker applies ignore rules before persisting findings
- Web UI: right-click a finding → "Ignore this selector"

---

### B-03 — Cross-Browser Capture Profiles

**What:** Support `chromium` (default), `webkit` (Safari), `firefox` engine selection per run.

**Why:** Cross-browser regressions are common and expensive. Strengthens parity with leading tools.

**Implementation:**
- Extend `CaptureConfig` in contracts with `browser?: "chromium" | "webkit" | "firefox"`
- Update `packages/capture` to launch the correct Playwright browser
- Add browser selector to the New Audit Form in web UI

---

### B-04 — Figma-to-Live Delta Normalization & Threshold Presets

**What:** Add low/medium/high sensitivity presets for the visual diff engine. Prevent font-rendering antialiasing and pixel-level noise from creating false positives.

**Why:** Makes Figma comparison less brittle. Item #7 in IMPLEMENTATION_PRIORITY_FEATURES.md.

**Implementation:**
- Add `sensitivityPreset?: "low" | "medium" | "high"` to `CreateRunSchema`
- Map preset to pixelmatch `threshold` and minimum region pixel size in `packages/compare`
- Show preset selector in New Audit Form

---

### B-05 — Smart Batch Approval with AI Categorization

**What:** Group diffs by change type (color changes, spacing changes, layout shifts) and allow bulk approve per category.

**Why:** Kills approval fatigue on large design system refactors. Biggest workflow pain for Chromatic and Percy users.

**Implementation:**
- Use LLM to categorize each finding into a change-type bucket
- Add bulk `PATCH /api/runs/:id/findings/bulk-review` endpoint
- Web UI: group findings by category with "Approve all in group" CTA

---

### B-06 — Multi-Theme / Dark Mode Native Support

**What:** Capture all theme variants (light, dark, brand themes) in a single run. Smart baseline per theme.

**Why:** First tool to solve this cleanly will own the design system market segment.

**Implementation:**
- Add `themes?: Array<{ name: string; cssClass?: string; prefersColorScheme?: "light" | "dark" }>` to run config
- Worker spawns one viewport run per (viewport × theme) combination
- Side-by-side theme comparison in UI

---

## Phase C — High Effort / Strategic

| # | Feature | Effort | Market Priority | Status |
|---|---------|--------|-----------------|--------|
| C-01 | **Design Token Validation** | High | Tier 1 | ⬜ |
| C-02 | **Core Web Vitals Correlation** | High | Tier 3 | ⬜ |
| C-03 | **Animation / Motion Regression Testing** | High | Tier 3 | ⬜ |
| C-04 | **Plugin API & Rule Authoring SDK** | High | Phase 4 Roadmap | ⬜ |
| C-05 | **Usage-Based Transparent Pricing Infrastructure** | High | Tier 3 | ⬜ |

### C-01 — Design Token Validation

**What:** Ingest design tokens from Style Dictionary or Tokens Studio. Compare computed CSS values on rendered elements against expected token values. Flag: *"Button uses #2563EB but --color-primary is #3B82F6"*

**Why:** Completely unaddressed by every competitor. Fast-growing design system market segment.

**Implementation:**
- Accept token JSON file upload (Style Dictionary / Tokens Studio format)
- New `packages/tokens` package to parse and normalize token trees
- New rule: `token-drift` — extracts CSS custom property values from DOM, compares against token file
- Report: per-element token drift table

---

### C-02 — Core Web Vitals Correlation

**What:** Show LCP / CLS / FID delta alongside visual diff per run. CLS is literally a visual regression metric.

**Why:** E-commerce and SEO-focused teams will pay premium for this.

**Implementation:**
- Use Playwright's built-in performance API to capture Core Web Vitals during capture
- Store as `performanceMetrics` JSON on `ViewportRun`
- Show correlation between visual changes and vitals regressions in the report UI

---

### C-03 — Animation / Motion Regression Testing

**What:** Capture CSS animations as a filmstrip. Detect regressions in timing, easing, and keyframe positions.

**Why:** Completely unaddressed by all competitors. High value for agencies with polished motion design.

**Implementation:**
- Add `captureAnimation: true` capture mode to Playwright config
- Record frames at fixed intervals during page transitions
- Compare filmstrips frame-by-frame with pixelmatch
- New `AnimationFinding` type

---

### C-04 — Plugin API & Rule Authoring SDK

**What:** Let the community add custom rule packs and integrations without changing the core.

**Why:** Phase 4 roadmap item. Creates a contributor ecosystem.

**Implementation:**
- Stable `Rule` interface (already defined in `packages/rules-core`)
- Published `@opendesign-qa/sdk` with rule authoring utilities + TypeScript types
- Plugin discovery via config file (`opendesign.config.ts`)
- Docs site with "Write your first rule" tutorial

---

### C-05 — Usage-Based Transparent Pricing Infrastructure

**What:** Pay per snapshot above free tier. No tier cliff. Kills the Percy ($0→$599) and Chromatic ($0→$149) pricing complaints.

**Why:** Top acquisition pain point for competitors. Alone could convert a large chunk of their free-tier users.

**Implementation:**
- Stripe Meter API for usage tracking
- `snapshots_used` counter on `Project` model
- Free tier: 5,000 snapshots/month; then $0.001/snapshot
- Usage dashboard in web app

---

## Progress Summary

| Phase | Total | Done | In Progress | Pending |
|-------|-------|------|-------------|---------|
| A — Low Effort | 7 | 5 | 0 | 2 |
| B — Medium Effort | 6 | 0 | 0 | 6 |
| C — High Effort | 5 | 0 | 0 | 5 |
| **Total** | **18** | **5** | **0** | **13** |
