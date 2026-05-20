# OpenDesign-QA — Sprint 1 Worker Execution Plan

**Plan Type:** Execution Plan
**Sprint:** 1
**Sprint Length:** 2 weeks
**Date:** 2026-05-18
**Scope:** Worker skeleton and job flow

---

## 1. Sprint Goal

Turn the worker into a real audit job consumer with a stable queue contract, visible job lifecycle, and test coverage for the processing shell.

By the end of Sprint 1, the worker should be able to:

1. Receive audit jobs from the queue.
2. Validate the job payload against shared contracts.
3. Record run lifecycle transitions.
4. Fail safely with clear logging.
5. Be ready for capture implementation in Sprint 2.

---

## 2. Sprint Outcome

This sprint does not deliver full screenshot capture yet.

Instead, it delivers the orchestration layer that every later worker feature depends on:

- queue wiring
- job contract alignment
- run status transitions
- failure visibility
- worker integration tests

---

## 3. In Scope

1. Define the worker job contract.
2. Wire the worker to the audit queue.
3. Add clear job lifecycle handling.
4. Record start, success, and failure states.
5. Add integration tests for the worker shell.
6. Document local worker startup expectations.

## 4. Out Of Scope

1. Playwright capture implementation.
2. DOM snapshot extraction.
3. Rule execution.
4. Artifact persistence.
5. Figma comparison.
6. Cross-browser profiles.

---

## 5. Dependency Map

### Required Before Sprint Completion

- Shared contracts in `packages/contracts/src/schemas.ts`
- Worker entrypoint in `apps/worker/src/index.ts`
- API run creation and queue handoff in `apps/api/src/index.ts`
- Redis available locally for queue processing

### Helpful But Not Blocking

- Database schema and persistence scaffolding in `packages/db/src/index.ts`
- Storage layer in `packages/storage/src/index.ts`

---

## 6. Work Breakdown

### Task 1 — Define Worker Job Contract

**Related ticket:** WP-001

**Goal:**
Create a single typed contract for audit jobs so the API and worker share the same payload shape.

**Work items:**
1. Add or extend a shared Zod schema for worker job payloads.
2. Include run ID, project ID, URL, selected viewports, and optional Figma frame URL.
3. Export the schema and TypeScript type from `packages/contracts`.
4. Update any API queue handoff code to use the shared schema.

**Acceptance check:**
- Invalid payloads fail validation before the worker processes them.
- The API and worker compile against the same contract.

**Estimated effort:** 2 story points

---

### Task 2 — Wire Worker To Audit Queue

**Related ticket:** WP-002

**Goal:**
Make the worker listen to the audit queue and process jobs with predictable lifecycle events.

**Work items:**
1. Confirm queue name and Redis connection settings.
2. Ensure the worker subscribes to the audit queue on startup.
3. Handle job start, completion, and failure logging.
4. Keep worker shutdown clean and deterministic.

**Acceptance check:**
- A queued job is consumed by the worker.
- The worker does not acknowledge a job until processing completes.
- Worker startup and shutdown work locally.

**Estimated effort:** 3 story points

---

### Task 3 — Record Job Lifecycle States

**Related ticket:** WP-007

**Goal:**
Track visible run state transitions so the UI can show what happened during processing.

**Work items:**
1. Define run states for pending, running, completed, and failed.
2. Update the API or worker handoff so the current state is persisted or exposed.
3. Capture error details on failure.
4. Keep state changes consistent across retries.

**Acceptance check:**
- Each job has a visible state transition path.
- Failed runs preserve a useful error message.

**Estimated effort:** 3 story points

---

### Task 4 — Add Worker Integration Tests

**Related ticket:** WP-008

**Goal:**
Prove the worker shell behaves correctly before capture logic is added.

**Work items:**
1. Add a happy-path worker test.
2. Add a queue failure or malformed payload test.
3. Add a shutdown or processing-error test.
4. Verify the tests run through the repo’s standard test command.

**Acceptance check:**
- Tests cover success and failure at the worker boundary.
- The test suite catches broken queue wiring early.

**Estimated effort:** 3 story points

---

## 7. Sprint Day-by-Day Execution

### Day 1-2: Contract And Queue Alignment

Focus:
- Finalize the worker job payload.
- Align API and worker expectations.

Deliverables:
1. Shared job schema.
2. Queue payload validation.
3. Updated handoff contract.

### Day 3-4: Worker Subscription And Lifecycle

Focus:
- Make the worker actively process jobs.
- Add explicit logging and state handling.

Deliverables:
1. Queue consumer running.
2. Job lifecycle transitions.
3. Failure logging.

### Day 5-6: Test Coverage

Focus:
- Add integration tests for the worker shell.
- Validate payload failure handling.

Deliverables:
1. Happy-path test.
2. Failure-path test.
3. Basic regression guard for worker startup.

### Day 7-8: Hardening And Cleanup

Focus:
- Review logs, failure handling, and startup assumptions.
- Tighten any contract or lifecycle gaps.

Deliverables:
1. Clean worker startup/shutdown behavior.
2. Test and contract polish.
3. Documentation updates if needed.

### Day 9-10: Sprint Review Prep

Focus:
- Verify the worker execution shell is ready for Sprint 2.

Deliverables:
1. Demo-ready queue processing flow.
2. Confirmed run-state visibility.
3. Sprint review notes and follow-up items.

---

## 8. Acceptance Criteria For Sprint 1

Sprint 1 is complete when:

1. The worker can consume an audit job from the queue.
2. The job payload is validated using shared contracts.
3. The worker logs start, success, and failure states.
4. Worker integration tests cover happy path and failure path.
5. The sprint leaves a clean base for capture implementation.

---

## 9. Definition Of Done For This Sprint

1. Code is merged.
2. Tests pass.
3. Shared contracts are updated where needed.
4. Worker execution is observable locally.
5. No unresolved queue contract mismatch remains.

---

## 10. Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Queue payload drift between API and worker | High | Use a shared contract and validate at the boundary |
| Worker startup is fragile locally | Medium | Document Redis and environment expectations clearly |
| State transitions are not visible | Medium | Add explicit lifecycle logging and status writes |
| Tests are too shallow to catch regressions | High | Add both happy-path and failure-path integration tests |

---

## 11. Sprint Review Checklist

1. Can a job enter the queue from the API path?
2. Does the worker consume it without manual intervention?
3. Are failures understandable from logs and status updates?
4. Do tests protect the queue and worker contract?
5. Is Sprint 2 capture work ready to start immediately?

---

## 12. Recommended Sprint 1 Ticket Order

1. WP-001 — Define Worker Job Contract
2. WP-002 — Wire Worker To Audit Queue
3. WP-007 — Update Run Status Lifecycle
4. WP-008 — Worker Integration Tests

This order reduces risk early by locking the contract before adding lifecycle and test hardening.
