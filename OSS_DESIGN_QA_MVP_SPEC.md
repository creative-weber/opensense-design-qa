# OpenDesign QA MVP Feature Specification

## Objective

Ship an initial version that proves the product can detect implementation defects on a live website and present useful evidence-backed findings, with optional Figma comparison for a single page.

## Target Users

1. Frontend developers validating UI quality before release.
2. Product designers checking implementation fidelity.
3. QA engineers performing visual regression and design review.
4. Open-source contributors building additional rule packs and integrations.

## Primary Jobs To Be Done

1. Audit a public page and find obvious design defects quickly.
2. Compare one live page against one Figma frame.
3. Share results with a team in a portable format.
4. Re-run the same audit after a fix and confirm improvement.

## MVP Scope

### In Scope

1. Analyze a single publicly accessible page per run.
2. Support desktop, tablet, and mobile viewports.
3. Capture screenshots and extract basic layout metadata.
4. Run deterministic design quality checks.
5. Show a report with severity, evidence, and suggested remediation.
6. Accept a Figma frame URL for one-frame comparison.
7. Export report data to JSON and Markdown.
8. Run in local self-hosted mode.

### Out Of Scope

1. Site crawling across multiple pages.
2. Full authenticated journeys.
3. Automatic bug fixing.
4. Team collaboration features.
5. Paid hosting workflows.
6. Full design system governance.

## MVP User Stories

### Developer

1. As a developer, I can submit a page URL and receive a list of design defects with screenshots.
2. As a developer, I can inspect which DOM element or region caused a finding.
3. As a developer, I can export a report for pull request review.

### Designer

1. As a designer, I can provide a Figma frame and see where the implementation differs.
2. As a designer, I can identify missing or misaligned UI blocks.
3. As a designer, I can review typography and color mismatches.

### QA

1. As a QA engineer, I can run the same audit against multiple viewports.
2. As a QA engineer, I can suppress known false positives using ignore rules.

## Functional Requirements

### Audit Setup

1. User can enter a live URL.
2. User can optionally provide a Figma frame URL.
3. User can choose one or more viewports.
4. User can set a basic sensitivity or tolerance preset.

### Capture

1. System renders the page in Playwright.
2. System captures a screenshot per viewport.
3. System records layout metadata for detected visible elements.

### Rules

The MVP rule set should include at least:

1. Overflow and clipping detection.
2. Overlap detection.
3. Alignment drift detection.
4. Spacing inconsistency detection.
5. Typography inconsistency detection.
6. Color mismatch detection.
7. Contrast warning detection.

### Figma Comparison

1. Fetch a single frame image and metadata.
2. Show a side-by-side comparison.
3. Highlight mismatched regions.
4. Flag likely missing blocks.

### Reporting

1. Findings must include title, severity, description, and evidence.
2. Findings must include viewport context.
3. Reports must include summary counts by severity.
4. Reports must be exportable to JSON and Markdown.

## Non-Functional Requirements

1. A standard public-page audit should complete in under 2 minutes for one viewport on a normal broadband connection.
2. Each finding must reference stored evidence.
3. The platform must run locally on a contributor machine using documented setup steps.
4. Failed rules should not crash the entire run.
5. The system should support retrying failed jobs safely.

## Success Metrics For MVP

1. At least 70 percent of reported high-severity findings are confirmed by early testers.
2. Less than 15 percent of runs fail due to internal system errors.
3. A contributor can set up the project locally in under 30 minutes using the README.
4. Early testers can understand the report without additional explanation.

## Milestones

### Milestone 1: Local Audit Foundation

Deliverables:

1. Monorepo setup.
2. Web app shell.
3. API and worker services.
4. Playwright capture pipeline.
5. Database and object storage integration.

Exit criteria:

1. A user can submit a URL and receive a stored screenshot.

### Milestone 2: Deterministic Rules MVP

Deliverables:

1. Initial rule framework.
2. Rule execution pipeline.
3. Severity model and evidence schema.
4. Report page listing findings.

Exit criteria:

1. A user can run a page audit and receive at least 5 classes of findings.

### Milestone 3: Figma Compare MVP

Deliverables:

1. Figma frame ingestion.
2. Frame screenshot retrieval.
3. Side-by-side comparison UI.
4. Region-based visual diff.

Exit criteria:

1. A user can compare one live page against one Figma frame and view mismatched regions.

### Milestone 4: Reporting And Export

Deliverables:

1. Markdown export.
2. JSON export.
3. Summary dashboard.
4. Ignore rules and rerun support.

Exit criteria:

1. A user can export a report and rerun the same audit config.

## Acceptance Criteria For Initial Release

1. The system supports one public URL and optional one-frame Figma input.
2. The report UI renders screenshots, findings, and severity summaries.
3. JSON and Markdown export work from both the UI and CLI.
4. Local development instructions are complete enough for outside contributors.
5. The app can process at least desktop and mobile viewports reliably.

## Risks And Mitigations

1. Figma comparison may generate false positives. Mitigation: start with visual and block-level diffing before deep node matching.
2. Dynamic sites can produce noisy capture results. Mitigation: add wait strategies, ignore regions, and deterministic capture hooks.
3. Rendering differences across systems may skew results. Mitigation: standardize on a pinned browser version for baseline audits.

## Immediate Backlog After MVP

1. Multi-page crawl mode.
2. GitHub Action integration.
3. Plugin SDK for rule packs.
4. Authenticated page flows.
5. Baseline-against-commit visual regression mode.