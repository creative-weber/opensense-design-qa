# OpenDesign QA

OpenDesign QA is an open-source platform for finding design defects in real websites and comparing live implementations against Figma designs.

It combines browser-based page capture, deterministic UI quality checks, visual diffing, and optional AI summaries to help developers, designers, and QA teams understand what is visually wrong and what is missing.

## Why This Exists

Most teams can detect broken code faster than broken design implementation. Layout drift, inconsistent spacing, typography mismatch, clipped content, and missing UI blocks often slip through because there is no shared workflow between design review and implementation QA.

OpenDesign QA aims to close that gap.

## Core Capabilities

1. Audit a live public page for visual and structural design defects.
2. Compare a live page against a Figma frame.
3. Highlight mismatches with evidence-backed findings.
4. Export reports as JSON and Markdown.
5. Run locally in a self-hosted open-source setup.

## Initial Scope

The first release is focused on:

1. Single-page audits.
2. Desktop, tablet, and mobile viewports.
3. Deterministic rules for common UI implementation defects.
4. Optional one-frame Figma comparison.

## Planned Architecture

The platform is expected to include:

1. A web app for creating and reviewing audits.
2. An API service for run management and persistence.
3. A worker service for browser capture, rules, and comparisons.
4. Shared packages for contracts, capture, rules, reporting, and UI.

## Example Use Cases

1. A frontend developer audits a page before merging a PR.
2. A designer checks whether a new landing page matches a Figma frame.
3. A QA engineer reruns the same audit after a fix and compares findings.
4. An open-source contributor adds a new rule pack.

## Principles

1. Evidence before opinion.
2. Deterministic checks before AI summaries.
3. Local-first and self-hostable by default.
4. Extensible through clear package boundaries and plugins.

## Status

This project is currently in planning and early architecture definition.

Current kickoff documents:

1. `OSS_DESIGN_QA_TECHNICAL_ARCHITECTURE.md`
2. `OSS_DESIGN_QA_MVP_SPEC.md`
3. `OSS_DESIGN_QA_MONOREPO_STRUCTURE.md`
4. `OSS_DESIGN_QA_OPEN_SOURCE_LAUNCH_PLAN.md`
5. `OSS_DESIGN_QA_ROADMAP.md`

## Early Development Priorities

1. Scaffold the monorepo.
2. Build the Playwright capture pipeline.
3. Add the first deterministic rules.
4. Build a basic report viewer.
5. Add a minimal Figma comparison flow.

## Contribution Direction

Initial contribution areas will include:

1. Rule development.
2. Capture reliability.
3. Figma parsing and normalization.
4. Documentation.
5. Export formats and CI integrations.

## License

To be decided before public launch. Apache-2.0 or MIT are the most practical initial options.