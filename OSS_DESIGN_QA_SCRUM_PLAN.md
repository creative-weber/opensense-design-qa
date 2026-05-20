# OpenDesign QA — Scrum Plan And Ticket Backlog

**Scrum Master Document**
**Version:** 1.0
**Date:** April 25, 2026
**Product:** OpenDesign QA (open-source)
**Sprint Length:** 2 weeks
**Team Velocity Estimate:** 40 story points per sprint (adjust after Sprint 1 retro)

---

## Table Of Contents

1. [Project Overview](#1-project-overview)
2. [Team Roles](#2-team-roles)
3. [Definition Of Ready](#3-definition-of-ready)
4. [Definition Of Done](#4-definition-of-done)
5. [Epic Map](#5-epic-map)
6. [Product Backlog — All Tickets](#6-product-backlog--all-tickets)
7. [Sprint Plan](#7-sprint-plan)
8. [Release Milestones](#8-release-milestones)
9. [Ceremonies Schedule](#9-ceremonies-schedule)
10. [Risks And Blockers Register](#10-risks-and-blockers-register)

---

## 1. Project Overview

OpenDesign QA is an open-source platform that:

1. Audits live websites for visual design defects using a browser capture engine and deterministic rules.
2. Compares live pages against Figma frames with pixel-level and block-level diffing.
3. Produces evidence-backed, exportable reports.

The MVP target is to deliver a locally runnable platform that handles single-page audits, a core rule set, and a one-frame Figma comparison flow.

---

## 2. Team Roles

| Role | Responsibility |
|---|---|
| Product Owner | Prioritizes backlog, accepts stories, sets release goals |
| Scrum Master | Facilitates ceremonies, unblocks team, tracks risks |
| Frontend Engineer | Web app, report UI, comparison viewer |
| Backend Engineer | API service, queue integration, persistence |
| Worker Engineer | Playwright capture, rule engine, comparison logic |
| Full-Stack Contributor | Shared packages, contracts, reporting |
| DevOps Contributor | Docker Compose, CI pipelines, deployment |

> For a small founding team, engineers will typically own multiple roles.

---

## 3. Definition Of Ready

A ticket is ready to be pulled into a sprint when:

1. Acceptance criteria are written.
2. Dependencies on other tickets are identified.
3. Design, API contract, or schema details are available if needed.
4. Story points are estimated.
5. No external blocker prevents starting the work.

---

## 4. Definition Of Done

A ticket is done when:

1. Code is merged to the main branch.
2. **[MANDATORY]** Unit or integration tests co-located with the source file cover the new behaviour (≥ 90 % line and branch coverage required).
3. **[MANDATORY]** E2E tests in `e2e/tests/` cover at least the happy path and one failure/edge case for every user-facing feature.
4. Existing tests still pass — **no PR is accepted if any test is red**.
5. Any shared type or schema changes are reflected in `packages/contracts`.
6. The feature works end-to-end in local development.
7. Relevant documentation or inline comments are updated.
8. `pnpm test:coverage` shows ≥ 90 % across all changed packages.

> **Testing is non-negotiable.** Skipping or deferring tests is not permitted at any sprint stage. Every ticket that produces runnable code must ship with both a unit/integration test layer and, where applicable, an E2E spec. This requirement applies from Day 1 of Sprint 0.

---

## 5. Epic Map

| Epic | Title | Phase |
|---|---|---|
| EP-01 | Monorepo And Development Environment | Phase 0 |
| EP-02 | Capture Pipeline | Phase 0 |
| EP-03 | Data Layer And Storage | Phase 0 |
| EP-04 | API Service | Phase 0 / 1 |
| EP-05 | Rule Engine Framework | Phase 1 |
| EP-06 | Built-In Web Rules | Phase 1 |
| EP-07 | Report UI | Phase 1 |
| EP-08 | Figma Ingestion | Phase 2 |
| EP-09 | Visual Comparison Engine | Phase 2 |
| EP-10 | Comparison Viewer UI | Phase 2 |
| EP-11 | Export And Reporting | Phase 1 / 2 |
| EP-12 | Worker Service And Queue | Phase 0 / 1 |
| EP-13 | Developer Experience And CI | Phase 2 / 3 |

---

## 6. Product Backlog — All Tickets

Story point scale: 1 = trivial, 2 = small, 3 = medium, 5 = large, 8 = very large, 13 = spike or epic-level.

---

### EPIC EP-01: Monorepo And Development Environment

---

#### ODQA-001 — Scaffold Monorepo

**Type:** Task
**Story Points:** 3
**Priority:** Critical

**Description:**
Initialise the `opendesign-qa` repository with a pnpm workspace and Turborepo configuration.

**Acceptance Criteria:**

1. Root `package.json` declares the workspace.
2. `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
3. `turbo.json` defines `build`, `test`, `lint`, and `dev` tasks with correct dependency topology.
4. Running `pnpm install` succeeds from the root.
5. Running `pnpm build` completes without errors when all packages have stub entry points.

---

#### ODQA-002 — Create Shared TypeScript And ESLint Config Package

**Type:** Task
**Story Points:** 2
**Priority:** Critical

**Description:**
Create `packages/config` with shared `tsconfig.base.json` and `.eslintrc.base.js` that all apps and packages extend.

**Acceptance Criteria:**

1. `packages/config/tsconfig.base.json` sets `strict: true`, `moduleResolution: bundler`, and `target: ES2022`.
2. `packages/config/.eslintrc.base.js` extends `eslint:recommended` and `@typescript-eslint/recommended`.
3. At least one other package extends both configs.

---

#### ODQA-003 — Create Shared Contracts Package

**Type:** Task
**Story Points:** 3
**Priority:** Critical

**Description:**
Create `packages/contracts` with TypeScript types for the domain model and shared Zod schemas.

**Acceptance Criteria:**

1. Package exports types for: `AuditRun`, `ViewportRun`, `Finding`, `FindingSeverity`, `CaptureArtifact`, `FigmaReference`, `IgnoreRule`.
2. Package exports Zod schemas for `CreateRunRequest` and `FindingSchema`.
3. Package builds cleanly.
4. Contracts are imported by both the `api` and `worker` stubs.

---

#### ODQA-004 — Docker Compose Development Environment

**Type:** Task
**Story Points:** 3
**Priority:** High

**Description:**
Create a `docker-compose.dev.yml` that brings up PostgreSQL, Redis, and MinIO for local development.

**Acceptance Criteria:**

1. `docker compose -f docker-compose.dev.yml up` starts all three services.
2. PostgreSQL is accessible on port 5432.
3. Redis is accessible on port 6379.
4. MinIO is accessible on port 9000 with a default local bucket.
5. A `.env.example` file documents the expected environment variables.
6. README includes a "Start dev infrastructure" section.

---

#### ODQA-005 — Root README And Contributing Guide

**Type:** Task
**Story Points:** 2
**Priority:** High

**Description:**
Finalise the repository README and add a `CONTRIBUTING.md`.

**Acceptance Criteria:**

1. README explains what the product does in under 100 words.
2. README includes a quick-start for local development.
3. `CONTRIBUTING.md` covers PR flow, branch naming, commit style, and how to add a rule.
4. Both files are reviewed by the PO.

---

### EPIC EP-02: Capture Pipeline

---

#### ODQA-006 — Create Capture Package Scaffold

**Type:** Task
**Story Points:** 2
**Priority:** Critical

**Description:**
Create `packages/capture` with an initial TypeScript package structure and Playwright as a dependency.

**Acceptance Criteria:**

1. Package has a typed `capture(url, viewport)` export.
2. Package builds cleanly.
3. Playwright browser dependencies install as part of `pnpm install`.

---

#### ODQA-007 — Implement Single-Page Screenshot Capture

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
As a worker, I can open a URL in Playwright, wait for the page to stabilise, and return a full-page screenshot buffer.

**Acceptance Criteria:**

1. `capture(url, viewport)` launches a headless Chromium instance.
2. Function waits for `networkidle` plus a 500ms grace period before capturing.
3. Function returns a `CaptureResult` with `screenshotBuffer`, `viewport`, `url`, and `capturedAt`.
4. Function handles non-200 responses and throws a typed `CaptureError`.
5. Unit test covers happy path and non-200 error path.

---

#### ODQA-008 — Extract DOM Layout Metadata

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
As a worker, after capturing a screenshot I can extract a flat list of visible elements with their bounding boxes, computed styles, and tag names.

**Acceptance Criteria:**

1. Capture returns a `DomSnapshot` array alongside the screenshot.
2. Each entry contains: `selector`, `tagName`, `boundingBox`, `computedFontSize`, `computedColor`, `computedBackgroundColor`, `overflow`.
3. Only elements with non-zero dimensions are included.
4. Unit test verifies correct extraction on a known local HTML fixture.

---

#### ODQA-009 — Support Multiple Viewport Presets

**Type:** Story
**Story Points:** 3
**Priority:** High

**Description:**
As a user, I can select one or more named viewport presets and receive a separate capture per viewport.

**Acceptance Criteria:**

1. Supported presets: `desktop` (1440×900), `tablet` (768×1024), `mobile` (390×844).
2. Custom viewport dimensions are accepted via config.
3. Each capture is stored independently per viewport.
4. Unit test covers all three built-in presets.

---

#### ODQA-010 — Page Stabilisation Hooks

**Type:** Story
**Story Points:** 3
**Priority:** Medium

**Description:**
As a worker, before capturing I can apply configurable wait strategies to handle slow or dynamic pages.

**Acceptance Criteria:**

1. Supported strategies: `networkidle`, `domcontentloaded`, `custom-selector-present`, `fixed-delay`.
2. Config accepts a list of strategies applied in order.
3. If a strategy times out it logs a warning and capture continues.
4. Unit test covers selector-present and fixed-delay strategies.

---

### EPIC EP-03: Data Layer And Storage

---

#### ODQA-011 — Create DB Package And Prisma Schema

**Type:** Task
**Story Points:** 5
**Priority:** Critical

**Description:**
Create `packages/db` with the Prisma schema for all core entities.

**Acceptance Criteria:**

1. Schema defines: `Project`, `AuditRun`, `ViewportRun`, `CaptureArtifact`, `Finding`, `FindingEvidence`, `IgnoreRule`.
2. `pnpm db:migrate` applies the schema to a local PostgreSQL instance.
3. `pnpm db:generate` regenerates the Prisma client.
4. Package exports a typed `db` client singleton.
5. Schema includes correct relations and indexes for frequent query patterns.

---

#### ODQA-012 — Object Storage Service For Artifacts

**Type:** Task
**Story Points:** 3
**Priority:** High

**Description:**
Create a typed storage adapter that persists and retrieves screenshot files and diff images using S3-compatible storage.

**Acceptance Criteria:**

1. Adapter supports `upload(key, buffer, mimeType)` and `getSignedUrl(key)`.
2. Adapter works with MinIO in local mode and real S3 in production mode, selected by environment variable.
3. Unit test uses a mock S3 client and confirms upload and URL generation.

---

#### ODQA-013 — Persist Capture Artifacts After A Run

**Type:** Story
**Story Points:** 3
**Priority:** High

**Description:**
As a worker, after a successful capture I can persist the screenshot buffer to object storage and store a `CaptureArtifact` record in the database.

**Acceptance Criteria:**

1. Screenshot is stored in object storage with a stable key based on `runId`, `viewport`, and `type`.
2. A `CaptureArtifact` row is created with `runId`, `viewport`, `artifactType: screenshot`, `storageKey`, and `capturedAt`.
3. Integration test confirms both records are created and the storage key resolves to a valid signed URL.

---

### EPIC EP-04: API Service

---

#### ODQA-014 — Scaffold API Service

**Type:** Task
**Story Points:** 3
**Priority:** Critical

**Description:**
Create `apps/api` with a Fastify server, Zod validation, and health endpoint.

**Acceptance Criteria:**

1. `GET /health` returns `200 { status: "ok" }`.
2. Server starts with `pnpm dev:api`.
3. Zod validation middleware returns structured 400 errors for bad request bodies.
4. Environment is loaded from `.env` and validated at startup.

---

#### ODQA-015 — Create Project And Run Endpoints

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
As a user, I can create a project and submit an audit run via the API.

**Acceptance Criteria:**

1. `POST /api/projects` creates a project and returns it.
2. `POST /api/runs` accepts `{ projectId, url, viewports, figmaFrameUrl? }` and creates an `AuditRun` with status `queued`.
3. `GET /api/runs/:id` returns the run with status and viewport run list.
4. Validation rejects clearly malformed URLs with a 400 and a clear message.
5. Integration tests cover all three endpoints.

---

#### ODQA-016 — Findings And Artifacts API Endpoints

**Type:** Story
**Story Points:** 3
**Priority:** High

**Description:**
As a report viewer, I can fetch findings and artifacts for a completed run.

**Acceptance Criteria:**

1. `GET /api/runs/:id/findings` returns a paginated list of findings sorted by severity descending.
2. `GET /api/runs/:id/artifacts` returns a list of artifact records with signed URLs.
3. Both endpoints return 404 when the run does not exist.
4. Integration tests cover all paths.

---

#### ODQA-017 — Ignore Rules API Endpoint

**Type:** Story
**Story Points:** 2
**Priority:** Medium

**Description:**
As a user, I can create an ignore rule for a run to suppress a known false positive.

**Acceptance Criteria:**

1. `POST /api/runs/:id/ignore-rules` accepts `{ selector?, region?, ruleId }` and creates an `IgnoreRule`.
2. Subsequent `GET /api/runs/:id/findings` excludes findings matched by ignore rules.
3. Integration test confirms suppression works.

---

### EPIC EP-12: Worker Service And Queue

---

#### ODQA-018 — Scaffold Worker Service

**Type:** Task
**Story Points:** 3
**Priority:** Critical

**Description:**
Create `apps/worker` that connects to Redis via BullMQ and processes jobs.

**Acceptance Criteria:**

1. Worker starts with `pnpm dev:worker`.
2. Worker connects to BullMQ queue named `audit-jobs`.
3. A received job is logged and acknowledged.
4. Worker shuts down gracefully on `SIGTERM`.

---

#### ODQA-019 — Queue Audit Jobs From API

**Type:** Story
**Story Points:** 3
**Priority:** Critical

**Description:**
As a system, when an audit run is created via the API it is enqueued immediately.

**Acceptance Criteria:**

1. `POST /api/runs` enqueues one job per viewport after creating the run record.
2. Each job payload contains `runId`, `viewportRunId`, `url`, `viewport`, and optional `figmaFrameUrl`.
3. Worker receives and logs the job.
4. Integration test confirms enqueue using a real BullMQ dev instance.

---

#### ODQA-020 — End-To-End Capture Job Execution

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
As a worker, I can receive a capture job, run the Playwright capture, persist artifacts, and update the viewport run status.

**Acceptance Criteria:**

1. Worker picks up a queued job, calls `capture()`, stores the result, and sets viewport run status to `captured`.
2. Failures set status to `failed` with a typed error code.
3. Failed jobs retry up to 3 times with exponential backoff.
4. Integration test covers success and retry paths.

---

### EPIC EP-05: Rule Engine Framework

---

#### ODQA-021 — Create Rules Core Package

**Type:** Task
**Story Points:** 5
**Priority:** Critical

**Description:**
Create `packages/rules-core` with the rule framework, rule result schema, evidence model, and execution harness.

**Acceptance Criteria:**

1. Package exports a `Rule` interface: `{ id, name, severity, run(snapshot): RuleResult[] }`.
2. `RuleResult` includes: `ruleId`, `title`, `description`, `severity`, `confidence`, `evidence[]`.
3. `Evidence` supports: `screenshotRegion`, `domSelector`, `computedValue`, `expectedValue`.
4. Package exports `runRules(rules, snapshot)` which executes all rules and collects results without crashing on partial failures.
5. A failed rule logs a warning and its result is recorded as a system error, not a finding.
6. Unit tests cover: happy path, partial failure, empty rule set.

---

#### ODQA-022 — Rule Execution Pipeline In Worker

**Type:** Story
**Story Points:** 3
**Priority:** Critical

**Description:**
As a worker, after a successful capture I can run the full rule set against the DOM snapshot.

**Acceptance Criteria:**

1. Worker loads all registered rules from `packages/rules-web`.
2. Worker runs `runRules()` against the captured `DomSnapshot`.
3. Findings are persisted as `Finding` rows linked to the `ViewportRun`.
4. Worker sets viewport run status to `rules_complete`.
5. Integration test confirms finding rows are created.

---

### EPIC EP-06: Built-In Web Rules

---

#### ODQA-023 — Rule: Overflow And Clipping Detection

**Type:** Story
**Story Points:** 3
**Priority:** High

**Description:**
As an auditor, the system detects elements whose content overflows their container.

**Acceptance Criteria:**

1. Rule detects elements where `scrollWidth > clientWidth` or `scrollHeight > clientHeight`.
2. Findings include the selector, bounding box, and the overflow axis.
3. Severity is `high` when overflow exceeds 20px, `medium` otherwise.
4. Unit test uses DOM snapshot fixtures with known overflow cases.
5. False-positive test confirms intentional overflow containers (e.g. `overflow: auto`) are not flagged.

---

#### ODQA-024 — Rule: Element Overlap Detection

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
As an auditor, the system detects two non-sibling visible elements whose bounding boxes intersect unexpectedly.

**Acceptance Criteria:**

1. Rule flags intersecting bounding box pairs where neither element is a known container of the other.
2. Known overlay patterns such as tooltips, dropdowns, and modals are ignored using a configurable allow-list of selectors.
3. Evidence includes both selectors and the intersection area.
4. Severity is `high` when intersection area exceeds 200 square pixels.
5. Unit test covers intersecting, nested, and adjacent cases.

---

#### ODQA-025 — Rule: Alignment Drift Detection

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
As an auditor, the system detects elements in a visible list or grid that are misaligned relative to their peers.

**Acceptance Criteria:**

1. Rule groups visible sibling elements and checks left-edge alignment variance.
2. Groups of fewer than 2 elements are skipped.
3. Findings include the group selector, the expected alignment, and the measured drift in pixels.
4. Severity is `medium`.
5. Unit test covers a clean grid, a drifted grid, and a single-child group.

---

#### ODQA-026 — Rule: Spacing Inconsistency Detection

**Type:** Story
**Story Points:** 5
**Priority:** Medium

**Description:**
As an auditor, the system detects vertical or horizontal gaps between elements that break a consistent spacing rhythm.

**Acceptance Criteria:**

1. Rule computes gap sequences between sequential sibling elements.
2. An outlier gap is flagged when it deviates more than 8px from the median gap in its group.
3. Evidence includes the two elements causing the outlier and the measured gap.
4. Severity is `low`.
5. Unit test covers: consistent spacing, one outlier, and all-different gaps.

---

#### ODQA-027 — Rule: Typography Inconsistency Detection

**Type:** Story
**Story Points:** 5
**Priority:** Medium

**Description:**
As an auditor, the system detects headings, labels, or body text that use inconsistent font sizes or weights not present in the dominant type scale.

**Acceptance Criteria:**

1. Rule computes the dominant font-size values from all text elements.
2. Any font-size appearing fewer than 3 times and not in the dominant scale is flagged.
3. Same logic applies to font-weight.
4. Evidence includes selector, found value, and the dominant scale values.
5. Severity is `medium`.
6. Unit test covers consistent scale, two-scale system, and multiple outliers.

---

#### ODQA-028 — Rule: Color Mismatch Detection

**Type:** Story
**Story Points:** 3
**Priority:** Medium

**Description:**
As an auditor, the system detects background or foreground colors that deviate significantly from the dominant palette used on the page.

**Acceptance Criteria:**

1. Rule builds a frequency map of `computedColor` and `computedBackgroundColor` values across all visible elements.
2. Colors appearing on fewer than 2 percent of elements are flagged as outliers unless they belong to `<button>`, `<a>`, or `<code>` tags.
3. Evidence includes selector, color value, and frequency.
4. Severity is `low`.
5. Unit test covers a consistent palette and a multi-outlier case.

---

#### ODQA-029 — Rule: Contrast Warning Detection

**Type:** Story
**Story Points:** 3
**Priority:** High

**Description:**
As an auditor, the system detects text elements that fail the WCAG AA contrast ratio threshold.

**Acceptance Criteria:**

1. Rule computes relative luminance for `computedColor` against `computedBackgroundColor`.
2. Flags any text element with a contrast ratio below 4.5 for normal text or 3.0 for large text (18px+).
3. Evidence includes selector, foreground color, background color, and measured ratio.
4. Severity is `high` for normal text failures, `medium` for large text failures.
5. Unit test covers failing, passing, and borderline cases.

---

### EPIC EP-07: Report UI

---

#### ODQA-030 — Scaffold Web App

**Type:** Task
**Story Points:** 3
**Priority:** Critical

**Description:**
Create `apps/web` with a Next.js project, Tailwind CSS, and TanStack Query.

**Acceptance Criteria:**

1. App starts with `pnpm dev:web`.
2. Root route renders a minimal shell with navigation.
3. TanStack Query client is configured with default stale time.
4. Tailwind CSS is configured with a base design token file.

---

#### ODQA-031 — New Audit Form

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
As a user, I can submit a new audit run from the web app.

**Acceptance Criteria:**

1. Form accepts: URL, viewport checkboxes (desktop/tablet/mobile), optional Figma frame URL.
2. URL field validates format client-side before submit.
3. On submit the form calls `POST /api/runs` and navigates to the run status page.
4. Submission is disabled while a request is in flight.
5. Errors from the API are shown inline.
6. Unit test covers validation behaviour and submission state.

---

#### ODQA-032 — Run Status And Progress Page

**Type:** Story
**Story Points:** 3
**Priority:** High

**Description:**
As a user, I can watch the progress of an active audit run.

**Acceptance Criteria:**

1. Page polls `GET /api/runs/:id` every 3 seconds while status is not terminal.
2. Polling stops when status is `complete` or `failed`.
3. A progress indicator shows the current step (queued, capturing, running rules, complete).
4. On completion the page links to the full report.
5. Unit test covers polling start, stop on completion, and stop on failure.

---

#### ODQA-033 — Findings Report Page

**Type:** Story
**Story Points:** 8
**Priority:** Critical

**Description:**
As a user, I can view all findings for a completed audit run.

**Acceptance Criteria:**

1. Page shows a summary panel with finding counts by severity.
2. Findings are grouped by severity and listed with title, description, and evidence.
3. Each finding expands to show the DOM selector, computed value, and expected value where available.
4. A screenshot thumbnail links to the full artifact.
5. Viewport tab or filter allows switching between desktop, tablet, and mobile results.
6. User can mark a finding as ignored, which calls `POST /api/runs/:id/ignore-rules`.
7. Unit test covers rendering with findings, empty state, and viewport switching.

---

#### ODQA-034 — Screenshot Viewer With Finding Overlay

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
As a user, I can view the captured screenshot with finding regions highlighted on top.

**Acceptance Criteria:**

1. Screenshot renders at a fixed container width with proportional scaling.
2. Each finding region is drawn as a labelled rectangle with a colour coded by severity.
3. Clicking a region scrolls to and highlights the corresponding finding in the list.
4. Unit test covers region rendering and click navigation.

---

### EPIC EP-08: Figma Ingestion

---

#### ODQA-035 — Create Figma Package Scaffold

**Type:** Task
**Story Points:** 2
**Priority:** High

**Description:**
Create `packages/figma` with an authenticated Figma API client.

**Acceptance Criteria:**

1. Client accepts a personal access token via environment variable.
2. Client exposes `getFile(fileKey)` and `getFrameImage(fileKey, nodeId)`.
3. Client handles rate limiting with retries.
4. Unit test mocks the Figma API and confirms correct token passing.

---

#### ODQA-036 — Parse Figma Frame URL

**Type:** Story
**Story Points:** 2
**Priority:** High

**Description:**
As a user, when I provide a Figma frame URL the system extracts the file key and node ID.

**Acceptance Criteria:**

1. Parser handles both `figma.com/file/...` and `figma.com/design/...` URL formats.
2. Returns `{ fileKey, nodeId }` or a typed `ParseError`.
3. Unit test covers both URL formats and a malformed URL.

---

#### ODQA-037 — Fetch Figma Frame Image And Metadata

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
As a worker, when a Figma frame URL is provided I can fetch the frame PNG and its node metadata.

**Acceptance Criteria:**

1. Worker fetches a 2x PNG render of the frame.
2. Worker fetches the node metadata including bounds, fills, text styles, and children names.
3. Both artifacts are persisted: image to object storage, metadata to a `FigmaReference` row.
4. Worker sets `FigmaReference.status` to `ready`.
5. Integration test confirms both artifacts are stored.

---

#### ODQA-038 — Normalize Figma Node Tree For Comparison

**Type:** Story
**Story Points:** 5
**Priority:** Medium

**Description:**
As a comparison engine, I can convert raw Figma node data into a flat, comparison-ready format.

**Acceptance Criteria:**

1. Output is a `FigmaSnapshot` array with entries for each visible leaf node.
2. Each entry contains: `name`, `absoluteBounds`, `type`, `fillColors`, `fontSize`, `fontWeight`, `visible`.
3. Invisible nodes are excluded.
4. Unit test compares a known Figma API response fixture to the expected normalized output.

---

### EPIC EP-09: Visual Comparison Engine

---

#### ODQA-039 — Create Compare Package Scaffold

**Type:** Task
**Story Points:** 2
**Priority:** High

**Description:**
Create `packages/compare` with Pixelmatch and Sharp as dependencies.

**Acceptance Criteria:**

1. Package exports a typed `diff(imageA, imageB, options)` function.
2. Package builds cleanly.

---

#### ODQA-040 — Pixel-Level Screenshot Diff

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
As a comparison engine, I can compute a pixel diff between two screenshots and return a diff image and a mismatch score.

**Acceptance Criteria:**

1. `diff(imageA, imageB)` returns `{ diffBuffer, mismatchRatio, mismatchCount }`.
2. Images are resized to the same dimensions before diffing if they differ.
3. Diff image highlights changed pixels in red on a greyscale background.
4. Unit test compares: identical images (0 mismatch), shifted images, and completely different images.

---

#### ODQA-041 — Block-Level Region Matching

**Type:** Story
**Story Points:** 8
**Priority:** High

**Description:**
As a comparison engine, I can identify which Figma blocks are present, absent, or misaligned in the live screenshot by grouping diff pixels into regions.

**Acceptance Criteria:**

1. Diff pixels are clustered into rectangular mismatch regions using a connected-component algorithm.
2. Each region is classified as: `missing` (high diff in area that is blank in live), `misaligned` (content present but shifted), or `restyled` (content present but colour or style changed).
3. Regions smaller than 100 square pixels are discarded as noise.
4. Unit test covers: clean match, large missing block, shifted block, and noise-only diff.

---

#### ODQA-042 — Generate Comparison Findings From Diff Regions

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
As a worker, I can convert comparison diff regions into `Finding` rows linked to a viewport run.

**Acceptance Criteria:**

1. Each classified region becomes a `Finding` with type `figma-comparison`.
2. Finding severity: `high` for `missing`, `medium` for `misaligned`, `low` for `restyled`.
3. Evidence includes: diff region coordinates, reference to Figma artifact, and reference to live screenshot.
4. Integration test confirms finding rows are created after a comparison job.

---

### EPIC EP-10: Comparison Viewer UI

---

#### ODQA-043 — Side-By-Side Comparison View

**Type:** Story
**Story Points:** 8
**Priority:** High

**Description:**
As a user, I can view the Figma frame and the live capture side by side with diff regions highlighted.

**Acceptance Criteria:**

1. Page shows Figma frame image and live screenshot at equal scale.
2. Overlay mode draws diff regions on the live screenshot.
3. Clicking a diff region highlights the corresponding finding in the list panel.
4. A toggle switches between: side-by-side, overlay, and live-only views.
5. Unit test covers rendering with diff regions, empty diff state, and view toggles.

---

#### ODQA-044 — Diff Overlay Controls

**Type:** Story
**Story Points:** 3
**Priority:** Medium

**Description:**
As a user, I can control the sensitivity and visual style of the diff overlay.

**Acceptance Criteria:**

1. Opacity slider adjusts the overlay transparency.
2. Region type filter checkboxes show or hide `missing`, `misaligned`, and `restyled` regions.
3. Controls are persisted in URL state so a link can share the same view.
4. Unit test covers slider interaction and filter toggle.

---

### EPIC EP-11: Export And Reporting

---

#### ODQA-045 — Create Reporting Package

**Type:** Task
**Story Points:** 3
**Priority:** High

**Description:**
Create `packages/reporting` with report generation logic for JSON and Markdown formats.

**Acceptance Criteria:**

1. `generateJsonReport(run, findings, artifacts)` returns a valid `ReportBundle` object.
2. `generateMarkdownReport(run, findings)` returns a Markdown string.
3. Markdown report includes: summary table, finding list by severity, and viewport breakdown.
4. Unit tests cover both generators.

---

#### ODQA-046 — JSON Export Endpoint

**Type:** Story
**Story Points:** 2
**Priority:** High

**Description:**
As a user, I can download the full audit report as a JSON file.

**Acceptance Criteria:**

1. `GET /api/runs/:id/export?format=json` returns `Content-Type: application/json` with the full report bundle.
2. Bundle includes: run metadata, all findings with evidence, viewport summaries, and artifact keys.
3. Integration test confirms the response matches the expected schema.

---

#### ODQA-047 — Markdown Export Endpoint

**Type:** Story
**Story Points:** 2
**Priority:** High

**Description:**
As a user, I can download the full audit report as a Markdown file.

**Acceptance Criteria:**

1. `GET /api/runs/:id/export?format=markdown` returns `Content-Type: text/markdown`.
2. Markdown includes a summary block, severity table, and a section per finding.
3. Integration test confirms the response renders coherently.

---

#### ODQA-048 — Export From Report UI

**Type:** Story
**Story Points:** 2
**Priority:** Medium

**Description:**
As a user, I can trigger a JSON or Markdown download from the report page.

**Acceptance Criteria:**

1. Report page has an "Export" dropdown with JSON and Markdown options.
2. Clicking either triggers the corresponding download.
3. Download starts within 2 seconds on a local network.
4. Unit test confirms download links resolve to the correct API endpoints.

---

### EPIC EP-13: Developer Experience And CI

---

#### ODQA-049 — GitHub Actions CI Pipeline

**Type:** Task
**Story Points:** 3
**Priority:** High

**Description:**
Set up a CI workflow that runs lint, type checks, and tests on every PR.

**Acceptance Criteria:**

1. Workflow runs on `pull_request` and `push` to `main`.
2. Steps: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
3. Workflow fails if any step fails.
4. Results are visible in the GitHub PR checks UI.

---

#### ODQA-050 — Local Development Seed Script

**Type:** Task
**Story Points:** 2
**Priority:** Medium

**Description:**
Create a seed script that populates the database with a sample project, run, and findings for local UI development.

**Acceptance Criteria:**

1. Running `pnpm db:seed` inserts a project, one complete audit run, and at least 10 findings across two viewports.
2. Seed is idempotent.
3. README documents the seed command.

---

#### ODQA-051 — Sample Audit Dataset For Demo

**Type:** Task
**Story Points:** 2
**Priority:** Low

**Description:**
Include a sample static report export in `examples/sample-report/` for demos and README screenshots.

**Acceptance Criteria:**

1. `examples/sample-report/report.json` is a valid `ReportBundle`.
2. `examples/sample-report/report.md` is the corresponding Markdown export.
3. README links to both files.

---

## 7. Sprint Plan

### Sprint 0 — Environment And Foundation

**Goal:** Every team member can run all services locally. Basic infrastructure is in place.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-001 | Scaffold Monorepo | 3 |
| ODQA-002 | Create Shared TypeScript And ESLint Config Package | 2 |
| ODQA-003 | Create Shared Contracts Package | 3 |
| ODQA-004 | Docker Compose Development Environment | 3 |
| ODQA-005 | Root README And Contributing Guide | 2 |
| ODQA-014 | Scaffold API Service | 3 |
| ODQA-018 | Scaffold Worker Service | 3 |
| ODQA-030 | Scaffold Web App | 3 |
| ODQA-011 | Create DB Package And Prisma Schema | 5 |
| ODQA-012 | Object Storage Service For Artifacts | 3 |

**Sprint Total: 30 points**

**Sprint 0 Exit Criteria:**
All three services start locally. Docker Compose brings up the database, queue, and storage. Schema migrates without error.

---

### Sprint 1 — Capture And Queue Pipeline

**Goal:** A URL can be submitted and a screenshot is captured, persisted, and visible in the database.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-006 | Create Capture Package Scaffold | 2 |
| ODQA-007 | Implement Single-Page Screenshot Capture | 5 |
| ODQA-008 | Extract DOM Layout Metadata | 5 |
| ODQA-009 | Support Multiple Viewport Presets | 3 |
| ODQA-010 | Page Stabilisation Hooks | 3 |
| ODQA-015 | Create Project And Run Endpoints | 5 |
| ODQA-019 | Queue Audit Jobs From API | 3 |
| ODQA-020 | End-To-End Capture Job Execution | 5 |
| ODQA-013 | Persist Capture Artifacts After A Run | 3 |

**Sprint Total: 34 points**

**Sprint 1 Exit Criteria:**
Submitting a POST to `/api/runs` results in a screenshot stored in object storage and a capture artifact row in the database.

---

### Sprint 2 — Rule Engine And Core Rules

**Goal:** A completed capture produces a report of measurable design findings.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-021 | Create Rules Core Package | 5 |
| ODQA-022 | Rule Execution Pipeline In Worker | 3 |
| ODQA-023 | Rule: Overflow And Clipping Detection | 3 |
| ODQA-024 | Rule: Element Overlap Detection | 5 |
| ODQA-025 | Rule: Alignment Drift Detection | 5 |
| ODQA-029 | Rule: Contrast Warning Detection | 3 |
| ODQA-016 | Findings And Artifacts API Endpoints | 3 |
| ODQA-049 | GitHub Actions CI Pipeline | 3 |

**Sprint Total: 30 points**

**Sprint 2 Exit Criteria:**
A run on a public page produces at least 3 finding types. Findings are returned via the API.

---

### Sprint 3 — More Rules And Report UI

**Goal:** A complete report page shows all findings with screenshots and overlays.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-026 | Rule: Spacing Inconsistency Detection | 5 |
| ODQA-027 | Rule: Typography Inconsistency Detection | 5 |
| ODQA-028 | Rule: Color Mismatch Detection | 3 |
| ODQA-031 | New Audit Form | 5 |
| ODQA-032 | Run Status And Progress Page | 3 |
| ODQA-033 | Findings Report Page | 8 |
| ODQA-017 | Ignore Rules API Endpoint | 2 |

**Sprint Total: 31 points**

**Sprint 3 Exit Criteria:**
A user can submit a URL via the web app, watch the run progress, and see the full findings report.

---

### Sprint 4 — Screenshot Viewer, Exports, And Figma Foundation

**Goal:** The report is fully interactive and exportable. Figma ingestion works end to end.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-034 | Screenshot Viewer With Finding Overlay | 5 |
| ODQA-045 | Create Reporting Package | 3 |
| ODQA-046 | JSON Export Endpoint | 2 |
| ODQA-047 | Markdown Export Endpoint | 2 |
| ODQA-048 | Export From Report UI | 2 |
| ODQA-035 | Create Figma Package Scaffold | 2 |
| ODQA-036 | Parse Figma Frame URL | 2 |
| ODQA-037 | Fetch Figma Frame Image And Metadata | 5 |
| ODQA-038 | Normalize Figma Node Tree For Comparison | 5 |

**Sprint Total: 28 points**

**Sprint 4 Exit Criteria:**
Reports are downloadable as JSON and Markdown. A Figma frame is fetchable and stored.

---

### Sprint 5 — Visual Comparison Engine And Comparison Viewer

**Goal:** A run with a Figma URL produces a visual diff with highlighted missing and misaligned regions.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-039 | Create Compare Package Scaffold | 2 |
| ODQA-040 | Pixel-Level Screenshot Diff | 5 |
| ODQA-041 | Block-Level Region Matching | 8 |
| ODQA-042 | Generate Comparison Findings From Diff Regions | 5 |
| ODQA-043 | Side-By-Side Comparison View | 8 |
| ODQA-044 | Diff Overlay Controls | 3 |

**Sprint Total: 31 points**

**Sprint 5 Exit Criteria:**
A user can submit a URL and Figma frame, view a diff, and see missing/misaligned regions highlighted in the UI.

---

### Sprint 6 — Polish, DX, And MVP Release Prep

**Goal:** The MVP is ready for first public release.

**Sprint Backlog:**

| Ticket | Title | Points |
|---|---|---|
| ODQA-050 | Local Development Seed Script | 2 |
| ODQA-051 | Sample Audit Dataset For Demo | 2 |
| ODQA-BUG-01 | Bug fixing buffer | 5 |
| ODQA-REFINE-01 | UI polish and responsive fixes | 5 |
| ODQA-REFINE-02 | Rule false-positive tuning | 5 |
| ODQA-DOCS-01 | Complete local setup documentation | 3 |
| ODQA-DOCS-02 | Rule authoring guide draft | 3 |

**Sprint Total: 25 points**

**Sprint 6 Exit Criteria:**
An external contributor can set up the project and run a full audit locally using only the README.

---

## 8. Release Milestones

| Milestone | Sprints | Tag | Criteria |
|---|---|---|---|
| M1: Capture Foundation | 0 and 1 | v0.1.0-alpha | Capture to storage works end to end |
| M2: Website Audit MVP | 2 and 3 | v0.2.0-alpha | Core rules plus report UI complete |
| M3: Exportable Reports | 4 | v0.3.0-beta | JSON, Markdown, Figma fetch done |
| M4: Figma Comparison | 5 | v0.4.0-beta | Pixel diff and comparison viewer done |
| M5: Public MVP Release | 6 | v0.1.0 | Polished, documented, contributor-ready |

---

## 9. Ceremonies Schedule

| Ceremony | When | Duration |
|---|---|---|
| Sprint Planning | Monday of Sprint Week 1, 10:00 | 90 min |
| Daily Standup | Every weekday, 09:15 | 15 min |
| Sprint Review | Friday of Sprint Week 2, 14:00 | 45 min |
| Sprint Retrospective | Friday of Sprint Week 2, 15:00 | 45 min |
| Backlog Refinement | Wednesday of Sprint Week 1, 14:00 | 60 min |

**Standup format (3 questions):**

1. What did I complete since the last standup?
2. What will I complete before the next standup?
3. Is anything blocking me?

---

## 10. Risks And Blockers Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-01 | Figma-to-DOM matching produces too many false positives | High | High | Ship block-level diff first, not deep node matching. Add tolerance controls. | Worker Engineer |
| R-02 | Dynamic page content causes capture noise | High | Medium | Add wait strategies (ODQA-010). Allow ignore regions. Document known noisy pages. | Worker Engineer |
| R-03 | Playwright rendering differences across OS | Medium | Medium | Pin Chromium version. Document browser version in Docker image. | DevOps |
| R-04 | Figma API rate limits block test runs | Medium | Medium | Cache fetched artifacts. Add retry with backoff in ODQA-035. | Backend Engineer |
| R-05 | Rule engine performance is too slow for MVP time budget | Medium | High | Profile after Sprint 2 review. Rules run in parallel where possible. | Worker Engineer |
| R-06 | Object storage setup complexity blocks contributors | Medium | High | Ensure MinIO works via Docker Compose with zero manual config. Seed provides immediate data. | DevOps |
| R-07 | Team velocity is lower than estimated 40 SP per sprint | Medium | Medium | Use Sprint 1 actuals to re-estimate before Sprint 2 planning. | Scrum Master |
