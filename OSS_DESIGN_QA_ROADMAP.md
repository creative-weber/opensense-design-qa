# OpenDesign QA Roadmap

## Roadmap Intent

This roadmap outlines the planned evolution from initial prototype to a stable open-source design QA platform.

## Phase 0: Foundation

Goals:

1. Finalize architecture and package boundaries.
2. Scaffold the monorepo and development environment.
3. Implement capture and storage basics.

Deliverables:

1. Workspace setup with web, api, and worker apps.
2. Shared contracts and config packages.
3. Local PostgreSQL, Redis, and object storage support.
4. First successful screenshot capture flow.

## Phase 1: Website Audit MVP

Goals:

1. Deliver evidence-backed website-only audits.
2. Validate that deterministic rules already provide useful value.

Deliverables:

1. Rule engine.
2. Overflow, overlap, alignment, spacing, typography, and contrast checks.
3. Findings report UI.
4. JSON and Markdown export.

Success signal:

1. Users can submit one public URL and receive a useful report without manual analysis.

## Phase 2: Figma Comparison MVP

Goals:

1. Introduce implementation-versus-design comparison.
2. Keep scope limited to one live page and one Figma frame.

Deliverables:

1. Figma frame ingestion.
2. Side-by-side comparison view.
3. Region-based diff overlays.
4. Initial missing-block and mismatch detection.

Success signal:

1. Users can see which visible regions do not match the design and review concrete evidence.

## Phase 3: Developer Workflow Integration

Goals:

1. Make the tool practical in CI and local review workflows.
2. Improve reruns and report sharing.

Deliverables:

1. CLI.
2. GitHub Action integration.
3. Saved audit configs.
4. Ignore rules and false-positive suppression.

Success signal:

1. Teams can use the tool as part of normal frontend review without excessive setup.

## Phase 4: Extensibility And Ecosystem

Goals:

1. Let the community add capabilities without changing the core.
2. Stabilize APIs and package boundaries.

Deliverables:

1. Plugin API.
2. Rule authoring SDK.
3. Public docs site.
4. Example plugins and integrations.

Success signal:

1. External contributors ship rules and integrations independently.

## Phase 5: Advanced Analysis

Goals:

1. Reduce noise in complex layouts.
2. Support richer implementation QA scenarios.

Deliverables:

1. Better element matching.
2. Dynamic content normalization.
3. Authenticated page flows.
4. Baseline-against-commit regression mode.

Success signal:

1. The platform can handle more realistic product surfaces with acceptable false-positive rates.

## Cross-Cutting Priorities

1. Keep the core installation usable without paid vendors.
2. Keep findings explainable and evidence-backed.
3. Prefer deterministic signals over opaque scoring.
4. Maintain a contributor-friendly codebase and documentation set.

## Release Outlook

1. `0.1.0`: local single-page audit with core rule set.
2. `0.2.0`: first Figma comparison flow.
3. `0.3.0`: CLI, exports, and CI integration.
4. `0.4.0`: plugin API and docs site.
5. `1.0.0`: stable report schema, stable extension surface, and production-ready docs.