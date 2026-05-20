# OpenDesign-QA — Worker Pipeline Scrum Plan

**Scrum Master Document**
**Version:** 1.0
**Date:** 2026-05-18
**Scope:** Implement the worker pipeline end-to-end for audit job execution.
**Sprint Length:** 2 weeks
**Estimated Velocity:** 18-24 story points per sprint for this focused workstream

---

## Table Of Contents

1. [Objective](#1-objective)
2. [Scope](#2-scope)
3. [Team Roles](#3-team-roles)
4. [Definition Of Ready](#4-definition-of-ready)
5. [Definition Of Done](#5-definition-of-done)
6. [Epic Map](#6-epic-map)
7. [Sprint Plan](#7-sprint-plan)
8. [Ticket Backlog](#8-ticket-backlog)
9. [Release Milestones](#9-release-milestones)
10. [Risks And Blockers](#10-risks-and-blockers)

---

## 1. Objective

Deliver a real audit worker pipeline that:

1. Consumes queued audit jobs.
2. Captures screenshots and DOM snapshots for selected viewports.
3. Runs deterministic visual-quality rules on the captured data.
4. Stores artifacts and findings.
5. Updates audit run status so the web app can show progress and results.

This workstream is the foundation for every later feature in OpenDesign-QA.

---

## 2. Scope

### In Scope

1. Queue processing for audit jobs.
2. Playwright-based capture execution.
3. DOM snapshot extraction.
4. Rule execution harness.
5. Artifact upload and persistence.
6. Run status updates and failure handling.
7. Worker-level tests and integration coverage.

### Out Of Scope

1. Figma comparison logic.
2. Cross-browser engine support beyond the initial browser profile.
3. Collaboration workflow and review actions.
4. Rich export formatting.
5. Design-system governance and multi-project orchestration.

---

## 3. Team Roles

| Role | Responsibility |
|---|---|
| Backend Engineer | Queue contract, run persistence, API handoff |
| Worker Engineer | Capture pipeline, rule execution, artifact persistence |
| Full-Stack Contributor | Shared contracts, schema updates, end-to-end coordination |
| QA Engineer | Fixture coverage, worker integration checks, failure scenarios |
| DevOps Contributor | Redis connectivity, worker startup configuration, local run stability |

---

## 4. Definition Of Ready

A ticket is ready when:

1. Input and output contracts are defined.
2. Acceptance criteria are written.
3. Dependencies on API, DB, or storage are identified.
4. A test plan exists.
5. The ticket can be started without waiting on external blockers.

---

## 5. Definition Of Done

A ticket is done when:

1. The code is merged to the main branch.
2. Unit or integration tests cover the new behaviour.
3. Worker-level failure paths are covered where applicable.
4. Shared contract changes are reflected in `packages/contracts`.
5. The feature works locally end-to-end.
6. Documentation or comments are updated if needed.
7. Existing tests still pass.

---

## 6. Epic Map

| Epic | Title | Goal |
|---|---|---|
| WP-EP1 | Queue And Worker Skeleton | Make the worker process jobs reliably |
| WP-EP2 | Capture Execution | Capture screenshots and DOM metadata |
| WP-EP3 | Rule Execution | Run deterministic checks on captures |
| WP-EP4 | Artifact Persistence | Save outputs and evidence for later use |
| WP-EP5 | Run Status Reporting | Expose progress and final state to the API |

---

## 7. Sprint Plan

### Sprint 1 — Worker Skeleton And Job Flow

Sprint goal:
- Turn the worker into a real job consumer with clear job input, error handling, and observable run status.

Deliverables:
1. Worker starts and subscribes to the audit queue.
2. Worker consumes a real audit job payload.
3. Job lifecycle updates are recorded consistently.
4. Worker failure modes are visible and testable.

### Sprint 2 — Capture And Rule Execution

Sprint goal:
- Capture the target page, extract DOM metadata, and execute the initial visual-quality rules.

Deliverables:
1. Playwright capture runs for one viewport.
2. DOM snapshot extraction is wired in.
3. Rule execution returns structured findings.
4. Capture failures and rule failures are isolated and recoverable.

### Sprint 3 — Persistence And Run Completion

Sprint goal:
- Persist capture artifacts and findings so the web app can render a complete run report.

Deliverables:
1. Artifacts are uploaded to object storage.
2. Findings are persisted in the database.
3. Run status transitions to completed or failed.
4. The API can expose the completed run state.

---

## 8. Ticket Backlog

### WP-001 — Define Worker Job Contract

**Type:** Task
**Story Points:** 2
**Priority:** Critical

**Description:**
Define the queue payload for audit jobs so the API and worker agree on the same job structure.

**Acceptance Criteria:**

1. Job payload includes run ID, project ID, target URL, selected viewports, and optional Figma frame URL.
2. Job payload is typed in shared contracts.
3. Validation rejects malformed job input.
4. API and worker both use the same contract.

**Starting Point:**
- `packages/contracts/src/schemas.ts`
- `apps/worker/src/index.ts`
- `apps/api/src/index.ts`

---

### WP-002 — Wire Worker To Audit Queue

**Type:** Story
**Story Points:** 3
**Priority:** Critical

**Description:**
Make the worker subscribe to the audit queue and process jobs with visible success and failure paths.

**Acceptance Criteria:**

1. Worker listens on the audit queue.
2. A job is acknowledged only after processing completes.
3. Failures are logged and surfaced.
4. The worker can start and stop cleanly in local development.

**Starting Point:**
- `apps/worker/src/index.ts`

---

### WP-003 — Implement Playwright Capture For One Viewport

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
Capture a live page with Playwright and return a screenshot buffer plus capture metadata.

**Acceptance Criteria:**

1. `capture()` launches a headless browser.
2. The page is opened at the requested URL.
3. A screenshot buffer is returned.
4. Capture metadata includes URL, viewport, and capture timestamp.
5. Non-200 and navigation failure paths throw typed errors.

**Starting Point:**
- `packages/capture/src/index.ts`

---

### WP-004 — Extract DOM Snapshot Metadata

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
Capture layout metadata for visible elements so rules can reason about spacing, overlap, overflow, and typography.

**Acceptance Criteria:**

1. Capture returns a DOM snapshot array.
2. Each snapshot includes selector, tag name, bounding box, and computed style fields.
3. Hidden or zero-sized elements are excluded.
4. The snapshot format is stable and typed.

**Starting Point:**
- `packages/capture/src/index.ts`

---

### WP-005 — Run The Rule Harness In Worker

**Type:** Story
**Story Points:** 5
**Priority:** Critical

**Description:**
Execute the rule engine against captured DOM snapshots and return structured findings.

**Acceptance Criteria:**

1. Worker calls the shared rule harness after capture.
2. Rule results are collected and attached to the run.
3. Rule failures do not crash the entire worker.
4. Findings include severity, evidence, and rule ID.

**Starting Point:**
- `packages/rules-core/src/index.ts`
- `apps/worker/src/index.ts`

---

### WP-006 — Persist Artifacts And Findings

**Type:** Story
**Story Points:** 5
**Priority:** High

**Description:**
Store screenshots, DOM snapshots, and rule findings so the API and UI can show completed runs.

**Acceptance Criteria:**

1. Capture artifacts are uploaded to object storage.
2. Findings are persisted in the database.
3. Artifact references are linked back to the run.
4. Persistence failures are handled explicitly.

**Starting Point:**
- `packages/storage/src/index.ts`
- `packages/db/src/index.ts`
- `apps/worker/src/index.ts`

---

### WP-007 — Update Run Status Lifecycle

**Type:** Task
**Story Points:** 3
**Priority:** High

**Description:**
Track run lifecycle states so the UI can show pending, running, completed, and failed states reliably.

**Acceptance Criteria:**

1. Runs move through a clear state lifecycle.
2. Worker writes status updates at key points.
3. The API can expose the latest run status.
4. Failed runs preserve error details for diagnosis.

**Starting Point:**
- `apps/api/src/index.ts`
- `apps/worker/src/index.ts`
- `packages/contracts/src/schemas.ts`

---

### WP-008 — Worker Integration Tests

**Type:** Task
**Story Points:** 3
**Priority:** Critical

**Description:**
Add integration tests for the worker pipeline using fixtures that verify success, capture failure, and rule failure.

**Acceptance Criteria:**

1. Happy-path worker processing is tested.
2. Capture-failure handling is tested.
3. Rule-failure handling is tested.
4. Tests run in the normal workspace test command.

**Starting Point:**
- `apps/worker/src/index.ts`
- `packages/capture/src/index.ts`
- `packages/rules-core/src/index.ts`

---

## 9. Release Milestones

### Milestone 1 — Queue Processing Working

Exit criteria:
1. A queued audit job is consumed by the worker.
2. The worker logs meaningful lifecycle events.
3. Run status changes are visible in the API layer.

### Milestone 2 — Capture And Rules Working

Exit criteria:
1. A live page can be captured.
2. DOM metadata is extracted.
3. Rules return findings for at least one fixture path.

### Milestone 3 — Persistence Working

Exit criteria:
1. Artifacts are uploaded and linked to a run.
2. Findings are stored and can be retrieved.
3. A completed run is ready for report rendering.

---

## 10. Risks And Blockers

| Risk | Impact | Mitigation |
|---|---|---|
| Playwright capture flakiness | Medium | Add wait strategies, retries, and fixture pages |
| Storage or DB contract drift | High | Keep shared schemas in `packages/contracts` |
| Worker failures killing processing | High | Isolate capture and rule errors; record status explicitly |
| Queue mismatch between API and worker | High | Keep a shared job contract and validate payloads |
| Slow local setup for contributors | Medium | Document worker startup and dependencies clearly |

---

## Appendix: Recommended First Sprint Order

1. WP-001 — Define Worker Job Contract
2. WP-002 — Wire Worker To Audit Queue
3. WP-003 — Implement Playwright Capture For One Viewport
4. WP-008 — Worker Integration Tests

This order establishes the job contract and processing shell before adding capture and persistence depth.
