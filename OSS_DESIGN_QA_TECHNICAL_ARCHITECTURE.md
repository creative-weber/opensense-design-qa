# OpenDesign QA Technical Architecture

## Purpose

This document defines the initial technical architecture for an open-source application that audits the visual quality of implemented websites and, when available, compares a live website against Figma designs.

Working product name: OpenDesign QA.

## Product Goals

1. Detect measurable UI and UX defects on live websites.
2. Compare real implementations against Figma frames and highlight missing or incorrect design details.
3. Produce actionable reports for developers, designers, and QA teams.
4. Support self-hosted and community-driven open-source adoption.
5. Expose a plugin model so contributors can add rules, analyzers, and integrations.

## Non-Goals For Initial Release

1. Perfect Figma-to-DOM semantic matching.
2. Automatic source-code fixes.
3. Full authenticated session replay.
4. Browser extension support.
5. Enterprise-only workflow features such as SSO, billing, and tenant management.

## Architecture Principles

1. Deterministic checks first, AI second.
2. Queue-based execution for all expensive analysis work.
3. Strong separation between capture, analysis, comparison, and reporting.
4. All findings must be explainable and traceable to source evidence.
5. The system must work in local development without any hosted dependency other than optional Figma access.

## High-Level System Context

Inputs:

1. Live website URL.
2. Optional Figma file URL and frame or node identifier.
3. Optional configuration such as viewport presets, ignored regions, thresholds, and selectors.

Outputs:

1. Structured audit findings.
2. Screenshot overlays and diffs.
3. Summary scorecards.
4. Exportable JSON and Markdown reports.

## Core Runtime Components

### 1. Web App

Responsibilities:

1. Accept audit requests.
2. Show run history and individual reports.
3. Display side-by-side comparison views.
4. Let users tune thresholds, ignore regions, and view false positives.

Suggested stack:

1. Next.js with TypeScript.
2. Tailwind CSS or a token-driven CSS system.
3. TanStack Query for client data fetching.

### 2. API Service

Responsibilities:

1. Accept run requests.
2. Validate input URLs and credentials.
3. Create analysis jobs.
4. Persist runs, findings, screenshots, and settings.
5. Serve report and comparison data to the UI and CLI.

Suggested stack:

1. Node.js with TypeScript.
2. Fastify or NestJS.
3. Zod for request and config validation.

### 3. Worker Service

Responsibilities:

1. Open pages in isolated browser sessions.
2. Capture screenshots, DOM trees, computed styles, and layout boxes.
3. Fetch Figma design metadata.
4. Run deterministic rules and visual comparison steps.
5. Store evidence artifacts and findings.

Suggested stack:

1. Node.js with TypeScript.
2. Playwright for rendering and capture.
3. Sharp plus Pixelmatch for image processing.

### 4. Queue Layer

Responsibilities:

1. Decouple request handling from execution.
2. Allow retries, concurrency limits, and prioritization.
3. Support long-running comparison jobs.

Suggested stack:

1. Redis.
2. BullMQ.

### 5. Data Layer

Responsibilities:

1. Persist audit metadata and findings.
2. Persist artifacts such as screenshots, diffs, and exported reports.
3. Track rule versions and run configurations for reproducibility.

Suggested stack:

1. PostgreSQL for transactional data.
2. S3-compatible object storage for screenshots and report assets.
3. Prisma ORM.

## Analysis Pipeline

### Step 1. Request Intake

1. User submits a URL.
2. User optionally submits Figma information.
3. API validates config and stores a new run.
4. API enqueues viewport-specific jobs.

### Step 2. Site Capture

1. Worker loads the target page with Playwright.
2. Worker waits for configurable network and layout stability signals.
3. Worker records screenshot, DOM snapshot, computed styles, and element bounding boxes.
4. Worker stores capture artifacts.

### Step 3. Figma Ingestion

1. Worker fetches the frame image and relevant node metadata from the Figma API.
2. Worker normalizes text styles, fills, spacing, and layout information.
3. Worker stores a flattened, comparison-ready representation.

### Step 4. Deterministic Audits

Initial rule families:

1. Overflow, clipping, and overlap detection.
2. Alignment and spacing consistency.
3. Typography scale anomalies.
4. Color mismatch and contrast checks.
5. Responsive layout regressions.
6. Missing semantic structure and basic accessibility defects.

### Step 5. Visual Comparison

1. Perform screenshot diffing between baseline and live capture, or between Figma frame and live capture.
2. Compute mismatch regions.
3. Rank regions by area, contrast, and intersection with known elements.

### Step 6. Element Matching

Initial strategy:

1. Match text-bearing elements by normalized text plus geometric proximity.
2. Match non-text blocks by relative position, size ratio, and visual similarity.
3. Use a confidence score for every match.
4. Report low-confidence comparisons separately from confirmed findings.

### Step 7. AI Summarization

AI is used only after deterministic processing.

Responsibilities:

1. Group related low-level findings.
2. Rewrite findings in human-readable language.
3. Propose remediation hints.
4. Highlight likely false positives.

Guardrails:

1. AI cannot fabricate evidence.
2. All summaries must reference concrete artifacts.
3. Raw findings remain available in the report.

## Domain Model

Core entities:

1. Project
2. AuditRun
3. ViewportRun
4. CaptureArtifact
5. FigmaReference
6. RuleExecution
7. Finding
8. FindingEvidence
9. IgnoreRule
10. ExportBundle

Example relationships:

1. A Project has many AuditRuns.
2. An AuditRun has many ViewportRuns.
3. A ViewportRun has many CaptureArtifacts and Findings.
4. A Finding has many evidence references such as DOM nodes, screenshots, and diff regions.

## Internal Package Boundaries

1. `@opendesign/contracts`: shared types, schemas, API contracts.
2. `@opendesign/capture`: Playwright capture logic.
3. `@opendesign/figma`: Figma API adapter and normalization.
4. `@opendesign/rules-core`: rule framework, severity model, evidence model.
5. `@opendesign/rules-web`: website-focused deterministic rules.
6. `@opendesign/compare`: visual and element comparison logic.
7. `@opendesign/reporting`: report shaping and export generation.
8. `@opendesign/ui`: shared design system.

## Public Interfaces

### API Endpoints

Initial endpoints:

1. `POST /api/runs`
2. `GET /api/runs/:id`
3. `GET /api/runs/:id/findings`
4. `GET /api/runs/:id/artifacts`
5. `POST /api/projects`
6. `POST /api/runs/:id/ignore-rules`

### CLI Commands

Initial commands:

1. `opendesign audit --url <url>`
2. `opendesign audit --url <url> --figma <frame-url>`
3. `opendesign export --run <id> --format markdown`
4. `opendesign serve`

## Plugin Model

The plugin system should allow community extensions without modifying the core platform.

Extension points:

1. Custom rule packs.
2. Custom capture hooks.
3. Alternate image diff engines.
4. Additional export formats.
5. Integrations for GitHub, GitLab, Slack, and issue trackers.

Plugin contract requirements:

1. Stable versioned API.
2. Clear sandbox and execution rules.
3. Deterministic result schema.

## Security And Privacy

1. Never store Figma access tokens in plain text.
2. Mask secrets from logs and exports.
3. Restrict browser execution to configured domains in hosted mode.
4. Make artifact retention configurable.
5. Document how local mode handles screenshots of sensitive pages.

## Observability

1. Structured logging for each pipeline stage.
2. Per-run timings for capture, rule execution, and diffing.
3. Rule-level counters for false positives and error rates.
4. Health endpoints for API, queue, Redis, and database services.

## Delivery Phases

### Phase 0

1. Single-page capture.
2. Deterministic rule execution.
3. Basic report UI.

### Phase 1

1. Figma frame ingestion.
2. Side-by-side view.
3. Screenshot diff overlays.

### Phase 2

1. Element matching and confidence scoring.
2. CLI and JSON exports.
3. GitHub Action integration.

### Phase 3

1. Multi-page projects.
2. Plugin ecosystem.
3. Improved AI summaries and triage.

## Open Technical Questions

1. How should the system normalize dynamic content for reliable comparisons?
2. What tolerance model should be used across browsers and operating systems?
3. Should mobile and desktop runs share a common finding identity or remain independent?
4. Should AI features be optional to keep the core install fully offline?
5. What is the minimum viable plugin API for community adoption?