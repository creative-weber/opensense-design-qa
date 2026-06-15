# OpenDesign QA — Post-MVP E2E Testing Plan

> Generated: June 2026
> Source: POST_MVP_FEATURES.md + MARKET-RESEARCH.md
> Test runner: Playwright + pnpm workspace scripts
> Status key: ⬜ Not written | 🔧 In progress | ✅ Written & passing

---

## Personas

These personas appear throughout the test cases. Using consistent characters makes each scenario feel like a real workflow rather than an isolated API call.

| Persona | Role | Use case |
|---------|------|----------|
| **Priya** | Frontend engineer, AcmeOps | Runs audits from the web UI before opening a PR |
| **Marcus** | Design system lead, DesignLab | Reviews every run from Slack; never opens the web app |
| **Lena** | Accessibility engineer, HealthPay | Checks WCAG compliance on every release candidate |
| **Dev (CLI user)** | CI/CD pipeline / any engineer | Runs `odqa run <url>` in GitHub Actions |
| **Jordan** | Product designer, AcmeOps | Reads plain-English summaries; cannot read diffs |
| **Simone** | Engineering manager, ScaleUp | Creates Jira tickets from findings; triages in Linear |

---

## Test File Naming Convention

```
odqa-<range>.<feature-slug>.spec.ts
```

Example file map (to be created under `e2e/tests/`):

| Spec file | Features covered |
|-----------|-----------------|
| `odqa-032-033.accessibility-overlay.spec.ts` | A-01 axe-core overlay |
| `odqa-034.root-cause-hints.spec.ts` | A-02 suggestedFix |
| `odqa-035-036.review-workflow.spec.ts` | A-03 finding review |
| `odqa-037.ai-diff-summary.spec.ts` | A-04 AI plain-English diff |
| `odqa-038-039.slack-notifications.spec.ts` | A-05 Slack webhook |
| `odqa-040-042.cli.spec.ts` | A-06 CLI |
| `odqa-043.breakpoint-matrix.spec.ts` | A-07 Responsive matrix |
| `odqa-044-045.jira-linear.spec.ts` | B-01 Jira / Linear |
| `odqa-046.ignore-rules.spec.ts` | B-02 Ignore rules |
| `odqa-047.cross-browser.spec.ts` | B-03 Cross-browser |
| `odqa-048.sensitivity-presets.spec.ts` | B-04 Delta normalization |
| `odqa-049.batch-approval.spec.ts` | B-05 Batch approval |
| `odqa-050.dark-mode.spec.ts` | B-06 Multi-theme |
| `odqa-story-2.lena-compliance-journey.spec.ts` | A-01 + A-02 story |
| `odqa-story-3.marcus-slack-review.spec.ts` | A-03 + A-05 story |
| `odqa-story-4.dev-ci-pipeline.spec.ts` | A-06 CLI story |

---

## Phase A — Low Effort / High Impact

---

### A-01 — Built-in Accessibility Overlay (axe-core)

**Spec file:** `odqa-032-033.accessibility-overlay.spec.ts`
**Run script to add to `e2e/package.json`:**
```jsonc
"test:accessibility": "playwright test --grep \"ODQA-032|ODQA-033\""
"test:accessibility:headed": "cross-env SLOW_MO=600 playwright test --headed --grep \"ODQA-032|ODQA-033\""
```

---

#### ODQA-032 — Lena audits a page and sees accessibility violations inline with visual findings

**Persona:** Lena (accessibility engineer)
**Preconditions:**
- API and worker are running
- The built-in `/fixtures/test-landing` page deliberately includes at least one element with insufficient color contrast and one image missing an `alt` attribute
- `WCAG_TEST_URL` env var points to that fixture (or `http://localhost:3000/fixtures/test-landing`)

**Steps:**

1. Lena opens the New Audit form at `http://localhost:3000`.
2. She types `http://localhost:3000/fixtures/test-landing` into the URL field.
3. She leaves viewports at the default (`desktop`) and submits the form.
4. The run transitions to `processing`. She watches the status badge update in real-time without refreshing.
5. The run completes (`rules_complete` or `complete`). She clicks "View Results".
6. On the results page she opens the Findings panel.
7. She sees at least one finding with `findingType = "accessibility"`.
8. She clicks that finding. The detail panel shows:
   - Impact badge: one of `critical`, `serious`, `moderate`, `minor`
   - WCAG rule ID (e.g. `color-contrast`, `image-alt`)
   - A "Help" link pointing to the axe-core documentation URL
   - At least one affected node with its HTML snippet visible
9. She clicks the Help link — it opens in a new tab pointing to `dequeuniversity.com` (the axe-core help URL).

**Expected outcomes:**
- `GET /api/runs/:id/findings` returns at least one finding where `findingType === "accessibility"`.
- That finding's `evidence[0].additionalData` contains `wcagTags` (an array starting with `"wcag"`).
- The finding's `evidence[0].additionalData.helpUrl` is a non-empty string.
- The UI renders an "Accessibility" badge or chip to distinguish these findings from visual rule findings.

**Failure scenario to also cover (ODQA-032b):**
- Audit a URL that is known to have zero WCAG violations (e.g. a blank white page fixture).
- Assert that the findings list contains zero `accessibility` type entries.
- Assert the run still completes normally — axe-core failure must not block the run.

---

#### ODQA-033 — Accessibility findings appear alongside visual rule findings in the same run

**Persona:** Priya (running her pre-PR audit)
**Preconditions:** Same as ODQA-032, plus at least one visual rule (e.g. `contrast-warning`) is expected to fire.

**Steps:**

1. Priya submits a new audit against `http://localhost:3000/fixtures/test-landing` using the API directly (simulating a CI-integrated call):
   ```
   POST /api/runs  { "projectId": "<id>", "url": "...", "viewports": ["desktop"] }
   ```
2. She polls `GET /api/runs/:id` every 2 s until the status is terminal.
3. She fetches `GET /api/runs/:id/findings`.
4. She filters by `findingType = "accessibility"` — expects ≥ 1.
5. She filters by `findingType != "accessibility"` — expects ≥ 1 visual finding.
6. She verifies both sets share the same `runId` — they come from the same audit, not two separate runs.

**Expected outcomes:**
- Both finding types are present in one response.
- No finding has a null or missing `severity`.
- Accessibility findings have severity mapped from axe-core impact: `critical` → `critical`, `serious` → `high`, `moderate` → `medium`, `minor` → `low`.

---

### A-02 — Root-Cause Hints Per Finding (suggestedFix)

**Spec file:** `odqa-034.root-cause-hints.spec.ts`
**Run script:**
```jsonc
"test:root-cause": "playwright test --grep \"ODQA-034\""
```

---

#### ODQA-034 — Every visual finding includes a plain-English fix suggestion

**Persona:** Priya
**Preconditions:** A completed audit run exists with at least one finding from the `contrast-warning` rule.

**Steps:**

1. Priya fetches `GET /api/runs/:id/findings?pageSize=50` after her run completes.
2. For each finding where `findingType !== "accessibility"` she looks at `evidence[0].additionalData`.
3. She checks that a `suggestedFix` key is present and not an empty string.
4. She opens the web UI results page, expands one finding from the "Contrast Warning" category.
5. A "Suggested Fix" section is visible in the finding detail panel, showing text like:
   > *"Increase contrast ratio to at least 4.5:1. Current ratio is 2.1:1. Consider using #1D4ED8 instead of the current foreground color."*
6. She expands a finding from "Element Overflow" — the fix says:
   > *"Add 'overflow: hidden' or 'overflow: auto' to `.hero-banner`…"*

**Expected outcomes:**
- `evidence[0].additionalData.suggestedFix` is a non-empty string for findings from all 7 built-in rules.
- The UI renders this text under a "Suggested Fix" heading — not buried inside raw JSON.
- Accessibility findings do NOT need a `suggestedFix` via this mechanism (they use `axe.helpUrl` instead) — this test should NOT fail if accessibility findings lack a `suggestedFix` key.

---

### A-03 — Finding Review Workflow

**Spec file:** `odqa-035-036.review-workflow.spec.ts`
**Run script:**
```jsonc
"test:review-workflow": "playwright test --grep \"ODQA-035|ODQA-036\""
```

---

#### ODQA-035 — Marcus acknowledges a known false positive and adds a note

**Persona:** Marcus (design system lead; his team runs a large refactor every sprint and always has findings to triage)
**Preconditions:** A completed run exists with at least 3 findings in `open` status.

**Steps:**

1. Marcus opens the run results page in the web UI.
2. He sees all findings are in "Open" status (grey badge).
3. He clicks the first finding. In the detail panel he sees a "Review" dropdown with options: **Open**, **Acknowledged**, **Ignored**, **Resolved**.
4. He selects **Acknowledged** and types a note: *"Known spacing increase from the 4px → 8px grid migration. Team approved."*
5. He clicks **Save Review**.
6. The badge on the finding card changes from grey "Open" to yellow "Acknowledged" without a full page reload.
7. He navigates away and back to the same run — the finding still shows "Acknowledged" with his note.

**API verification (done inside the test):**
```
PATCH /api/findings/:id/review
Body: { "status": "acknowledged", "note": "Known spacing increase..." }
```
Response contains: `{ reviewStatus: "acknowledged", reviewNote: "Known spacing increase...", reviewedAt: "<ISO timestamp>" }`

**Expected outcomes:**
- `reviewedAt` is a valid ISO 8601 date close to `Date.now()` (within 5 s).
- `GET /api/runs/:id/findings` returns the updated finding with the new status.
- The UI badge and note both persist after a hard reload.

---

#### ODQA-036 — Marcus bulk-ignores a batch of findings and the run summary updates

**Persona:** Marcus
**Preconditions:** Same run as ODQA-035, 3 remaining findings in `open`.

**Steps:**

1. Marcus patches two more findings in quick succession:
   - Finding 2: status `ignored`, note `"Dynamic content — timestamp changes every load."`
   - Finding 3: status `resolved`, no note.
2. He returns to the run list page.
3. The run row shows a "Review Progress" indicator: e.g. `3 / 3 reviewed`.
4. He clicks "Filter: Open" — the list is now empty.
5. He clicks "Filter: Ignored" — sees the two ignored findings.

**Expected outcomes:**
- All 3 PATCH requests return `200`.
- Filtering by status on `GET /api/runs/:id/findings?reviewStatus=open` returns 0 results.
- Filtering by `reviewStatus=ignored` returns exactly 2.
- Filtering by `reviewStatus=resolved` returns exactly 1.

---

### A-04 — AI Plain-English Diff Summary

**Spec file:** `odqa-037.ai-diff-summary.spec.ts`
**Run script:**
```jsonc
"test:ai-summary": "playwright test --grep \"ODQA-037\""
```

**Note:** This test requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to be set. When absent the test should be skipped gracefully with `test.skip(!process.env.OPENAI_API_KEY, "No LLM key set")`.

---

#### ODQA-037a — Jordan reads a plain-English diff summary after a Figma comparison run

**Persona:** Jordan (product designer — can read English, cannot read pixel diffs)
**Preconditions:**
- `OPENAI_API_KEY` is set in the test environment.
- A Figma frame URL is provided (the community Analytics Dashboard fixture used in `odqa-story`).
- The worker's Figma comparison produced a non-trivial diff image.

**Steps:**

1. Jordan submits a new audit run via the web form, entering the Figma frame URL alongside the page URL.
2. The run completes. She opens the results page.
3. At the top of the results page she sees an "AI Summary" card (not buried in findings) with text similar to:
   > *"The primary navigation bar has shifted 8 px to the right. The hero section heading is using Inter 700 instead of the expected Inter 800 weight. Three card components have incorrect padding (16 px vs the expected 24 px)."*
4. She can expand the card to see which Figma frame was compared against.
5. She clicks "Approve" on the summary — the run's review state moves to `acknowledged`.

**API verification:**
- `GET /api/runs/:id` response body includes `aiSummary: string` (non-empty).

**Expected outcomes:**
- The AI summary is at most 5 sentences / 150 words.
- It does not hallucinate component names that are not in the diff image.
- The "AI Summary" section is clearly labelled as AI-generated (e.g. "✦ AI Summary").

---

#### ODQA-037b — Run without LLM key completes normally with no AI summary

**Steps:**

1. Submit a run with `OPENAI_API_KEY` explicitly unset (use `delete process.env.OPENAI_API_KEY`).
2. Wait for run completion.
3. Assert `GET /api/runs/:id` returns `aiSummary: null` or the field is absent.
4. The web UI shows no "AI Summary" card — no broken section or empty placeholder.

---

### A-05 — Slack Approval Workflow

**Spec file:** `odqa-038-039.slack-notifications.spec.ts`
**Run script:**
```jsonc
"test:slack": "playwright test --grep \"ODQA-038|ODQA-039\""
```

**Setup:** Tests use a local Slack webhook mock server (e.g. `@slack/bolt` in test mode, or a simple `http.createServer` that records POSTed payloads).

---

#### ODQA-038 — Marcus gets a Slack notification after a run completes

**Persona:** Marcus (never opens the web app; reviews everything from Slack)
**Preconditions:**
- `SLACK_WEBHOOK_URL` is set to `http://localhost:9999/slack-mock` (the test mock server).
- The mock server records all incoming POST bodies.

**Steps:**

1. Submit a new audit run via `POST /api/runs` with a URL that will produce at least 2 findings.
2. Wait for the run to reach terminal status.
3. Query the mock server's recorded payloads.
4. Assert exactly one POST was received.
5. Parse the Slack Block Kit payload. Verify:
   - Header block text contains the run URL (the page being audited).
   - A section block mentions `critical` or `high` severity count ≥ 0.
   - A button with `action_id: "view_report"` is present, and its URL points to `http://localhost:3000/runs/<id>`.
   - At least one finding title is listed in the message body (top-3 findings block).
6. Marcus's teammate with the `@channel` mention should be present when there are critical findings.

**Expected outcomes:**
- Slack payload sends within 3 s of run completion.
- The `"View Report"` button URL matches the actual run ID.
- Severity emoji mapping is correct: 🔴 critical, 🟠 high, 🟡 medium, 🔵 low, ⚪ info.

---

#### ODQA-039 — Run completes normally when SLACK_WEBHOOK_URL is not set

**Steps:**

1. Unset `SLACK_WEBHOOK_URL` in the worker environment.
2. Submit and complete a normal audit run.
3. Assert the run reaches `rules_complete` or `complete` — it must not fail or hang.
4. Assert the mock server received zero POST requests.

---

### A-06 — CLI (`@opendesign-qa/cli`)

**Spec file:** `odqa-040-042.cli.spec.ts`
**Run script:**
```jsonc
"test:cli": "playwright test --grep \"ODQA-040|ODQA-041|ODQA-042\""
```

**Note:** These tests use `childProcess.spawn` / Node.js `execSync` inside the Playwright test to invoke `odqa run <url>` as a real subprocess. The API server must be running on port 3001.

---

#### ODQA-040 — Dev runs `odqa run` in a terminal and reads the colored output

**Persona:** Dev (engineer running the CLI locally before pushing)
**Preconditions:** `packages/cli` is built (`pnpm --filter @opendesign-qa/cli run build`). `node_modules/.bin/odqa` resolves.

**Steps:**

1. Dev opens a terminal and runs:
   ```bash
   odqa run http://localhost:3000/fixtures/test-landing --viewport desktop
   ```
2. The CLI prints a spinner: `⠋ Submitting audit...`
3. The CLI prints: `✓ Run created: <run-id>`
4. The CLI prints a progress line updating every 2 s: `⠇ Processing... (8s elapsed)`
5. When the run completes the CLI prints a severity table:
   ```
   ┌─────────────┬───────┐
   │ Severity    │ Count │
   ├─────────────┼───────┤
   │ 🔴 Critical │   0   │
   │ 🟠 High     │   2   │
   │ 🟡 Medium   │   5   │
   │ 🔵 Low      │   1   │
   └─────────────┴───────┘
   ```
6. Below the table, up to 10 findings are listed with their rule name and DOM selector.
7. The process exits with code `0` when no critical/high findings are present, or `1` when any critical/high findings exist.

**Expected outcomes (assertions inside the test):**
- `stdout` contains the run ID.
- `stdout` contains the severity table.
- The process exit code is `0` or `1` depending on findings severity — never any other code.
- The total elapsed time from invocation to exit is < `RUN_TIMEOUT` (120 s).

---

#### ODQA-041 — Dev saves a JSON report to disk with `--output`

**Persona:** Dev (in a CI pipeline that archives artifacts)

**Steps:**

1. Dev runs:
   ```bash
   odqa run http://localhost:3000/fixtures/test-landing --output ./report.json
   ```
2. The run completes. The CLI prints: `✓ Report saved to ./report.json`
3. Dev opens `./report.json`. It contains:
   - `runId` string
   - `url` string
   - `status` string
   - `findings` array with at least one item
   - Each finding has `id`, `severity`, `findingType`, `evidence`

**Expected outcomes:**
- File exists and is valid JSON.
- `findings` array is non-empty.
- No PII or internal tokens are present in the file.

---

#### ODQA-042 — CLI exits with code 1 and prints a clear error when the API is unreachable

**Persona:** Dev (misconfigured environment — wrong `--api` flag)

**Steps:**

1. Dev runs:
   ```bash
   odqa run http://example.com --api http://localhost:19999
   ```
   (port 19999 has nothing listening on it)
2. The CLI prints an error message: `✗ Could not connect to OpenDesign QA API at http://localhost:19999`
3. It does **not** print a Node.js stack trace.
4. The process exits with code `1`.

**Expected outcomes:**
- Exit code is exactly `1`.
- `stderr` contains a user-friendly error, not a raw `ECONNREFUSED` dump.

---

### A-07 — Responsive Breakpoint Matrix View

**Spec file:** `odqa-043.breakpoint-matrix.spec.ts`
**Run script:**
```jsonc
"test:matrix": "playwright test --grep \"ODQA-043\""
```

---

#### ODQA-043 — Priya sees all three viewport screenshots side-by-side without scrolling

**Persona:** Priya (checking that her responsive layout holds across breakpoints before merging)
**Preconditions:** A run was submitted with `viewports: ["mobile", "tablet", "desktop"]` and has completed.

**Steps:**

1. Priya opens the run results page.
2. She clicks the "Matrix View" tab (or navigates to `/runs/:id/matrix`).
3. The page renders three screenshot tiles side-by-side: **Mobile** (375 px), **Tablet** (768 px), **Desktop** (1280 px).
4. Each tile has a label showing the viewport name and pixel width.
5. She clicks the "Mobile" tile — a lightbox opens with the full-resolution screenshot.
6. She presses `Escape` — the lightbox closes.
7. She notices the "Mobile" tile has a red border and a badge `3 findings` — those are the findings scoped to that viewport.
8. She clicks the badge. The side panel filters findings to mobile viewport only.

**Expected outcomes:**
- All 3 viewport tiles are visible without horizontal scrolling on a 1440 px wide browser window.
- Clicking a tile opens the screenshot at full resolution.
- The findings badge count matches `GET /api/runs/:id/findings?viewport=mobile` count.
- The page renders in under 2 s (screenshot images are lazy-loaded via signed URLs).

---

## Phase B — Medium Effort

---

### B-01 — Jira / Linear Bug Creation

**Spec file:** `odqa-044-045.jira-linear.spec.ts`
**Run script:**
```jsonc
"test:jira-linear": "playwright test --grep \"ODQA-044|ODQA-045\""
```

**Setup:** Both tests use WireMock / `nock` / MSW to intercept outbound Jira and Linear API calls. No real external API credentials are needed.

---

#### ODQA-044 — Simone creates a Jira ticket from a critical finding in one click

**Persona:** Simone (engineering manager; triages findings and files tickets for her team)
**Preconditions:**
- A completed run has at least one `critical` or `high` finding.
- `JIRA_BASE_URL`, `JIRA_PROJECT_KEY`, and `JIRA_API_TOKEN` env vars are set (pointing to the WireMock stub).
- WireMock is configured to return `{ "id": "10023", "key": "ACME-42", "self": "https://acme.atlassian.net/rest/api/3/issue/10023" }` for `POST /rest/api/3/issue`.

**Steps:**

1. Simone opens the findings detail panel for the critical finding.
2. She clicks **"Create Ticket → Jira"**.
3. A confirmation dialog appears pre-filled with:
   - **Summary:** `[OpenDesign QA] <finding rule name> on <selector>`
   - **Description:** before/after screenshot inline, affected selector, run URL, rule description.
   - **Priority:** mapped from finding severity (`critical` → `Highest`, `high` → `High`).
4. Simone clicks **Submit**.
5. A success toast appears: `Jira ticket ACME-42 created.`
6. The finding card now shows a Jira logo badge linking to `https://acme.atlassian.net/browse/ACME-42`.

**API verification:**
```
POST /api/findings/:id/create-ticket
Body: { "provider": "jira" }
```
Response: `{ "externalTicketUrl": "https://acme.atlassian.net/browse/ACME-42", "ticketKey": "ACME-42" }`

**Expected outcomes:**
- The Jira stub received exactly one `POST /rest/api/3/issue` call.
- `externalTicketUrl` is persisted — if Simone refreshes the page the badge is still there.
- Creating a ticket a second time on the same finding shows a confirmation: *"A ticket already exists: ACME-42. Create another?"*

---

#### ODQA-045 — Simone creates a Linear issue from a finding

**Persona:** Simone
**Preconditions:** `LINEAR_API_KEY` and `LINEAR_TEAM_ID` set to Linear GraphQL stub.

**Steps:**

1. Simone clicks **"Create Ticket → Linear"** on a `high` severity finding.
2. The dialog pre-fills with the same fields as Jira but uses Linear terminology (Issue, Priority label).
3. She submits. The finding card shows the Linear issue URL.

**Expected outcomes:**
- Linear GraphQL stub received one `createIssue` mutation.
- `externalTicketUrl` contains `linear.app`.

---

### B-02 — Dynamic Ignore Rules & Noise Controls

**Spec file:** `odqa-046.ignore-rules.spec.ts`
**Run script:**
```jsonc
"test:ignore-rules": "playwright test --grep \"ODQA-046\""
```

---

#### ODQA-046 — Priya right-clicks a false-positive finding and never sees it again

**Persona:** Priya (the `/fixtures/test-landing` page has a countdown timer that always triggers a typography rule — it is never a real bug)
**Preconditions:** A completed run has at least one finding from the `typography-inconsistency` rule on the selector `.countdown-timer`.

**Steps:**

1. Priya opens the findings panel. She sees `.countdown-timer` — typography inconsistency.
2. She right-clicks (or opens the "⋯" menu) on the finding and selects **"Ignore this selector"**.
3. A side panel opens pre-filled with:
   - **Selector:** `.countdown-timer`
   - **Rule:** `typography-inconsistency`
   - **Scope:** this project (not just this run)
4. She clicks **Save**.
5. She submits a new run against the same URL.
6. The new run completes. She opens findings.
7. The `.countdown-timer` typography finding is absent.
8. All other findings are still present.

**Expected outcomes:**
- `POST /api/projects/:projectId/ignore-rules` returns `201`.
- `GET /api/projects/:projectId/ignore-rules` lists the new rule.
- The second run's findings do not include any finding matching both `.countdown-timer` and `typography-inconsistency`.
- Other findings from that run are unaffected.

---

### B-03 — Cross-Browser Capture Profiles

**Spec file:** `odqa-047.cross-browser.spec.ts`
**Run script:**
```jsonc
"test:cross-browser": "playwright test --grep \"ODQA-047\""
```

---

#### ODQA-047 — Priya discovers a Safari-only layout bug by running WebKit

**Persona:** Priya (a user reported a Safari bug — she wants to reproduce it before fixing it)
**Preconditions:** `webkit` Playwright browser is installed (`npx playwright install webkit`).

**Steps:**

1. Priya submits an audit via the New Audit form.
2. She expands the "Advanced" section and selects **Browser: Safari (WebKit)** from the dropdown.
3. She submits.
4. The run completes. The results page header shows a Safari icon next to the URL.
5. She runs a second audit against the same URL with the default **Browser: Chromium**.
6. She opens both run results side-by-side (by opening the second in a new browser tab).
7. The WebKit run shows an `overflow-clipping` finding on `.hero-section` that the Chromium run does not have.

**API verification:**
```
POST /api/runs { ..., "browser": "webkit" }
GET /api/runs/:id  →  body includes "browser": "webkit"
```

**Expected outcomes:**
- The `browser` field is stored on the run and returned in `GET /api/runs/:id`.
- The WebKit run's screenshots visually differ from the Chromium screenshots (pixel-level diff > 0).
- The run status reaches `complete` (not `failed`) for both browsers.

---

### B-04 — Figma-to-Live Delta Normalization & Sensitivity Presets

**Spec file:** `odqa-048.sensitivity-presets.spec.ts`
**Run script:**
```jsonc
"test:sensitivity": "playwright test --grep \"ODQA-048\""
```

---

#### ODQA-048 — Marcus stops getting font-rendering false positives by switching to low sensitivity

**Persona:** Marcus (tired of approving the same antialiasing noise on macOS Retina screenshots every sprint)

**Steps:**

1. Marcus submits a run with `sensitivityPreset: "high"` (the strictest preset) against the test-landing fixture.
2. The run completes. He notes N findings, several of which are tiny sub-pixel differences.
3. He submits a second run against the same URL, this time with `sensitivityPreset: "low"`.
4. The run completes. The finding count is ≤ N.
5. The sub-pixel typography-inconsistency findings that appeared in the `high` run are absent in the `low` run.
6. A layout shift finding that was present in the `high` run is **still present** in the `low` run (sensitivity does not suppress structural issues, only noise).

**Expected outcomes:**
- `low` run finding count ≤ `high` run finding count.
- `low` run does not contain any finding where `evidence[0].computedValue` and `evidence[0].expectedValue` differ by less than 2 px.
- Both runs reach `complete` status.

---

### B-05 — Smart Batch Approval with AI Categorization

**Spec file:** `odqa-049.batch-approval.spec.ts`
**Run script:**
```jsonc
"test:batch-approval": "playwright test --grep \"ODQA-049\""
```

---

#### ODQA-049 — Marcus approves all spacing findings in one click after a grid migration

**Persona:** Marcus (his team just migrated from a 4 px to 8 px base grid — 47 spacing findings are all expected)
**Preconditions:** A run has ≥ 5 findings categorized as `spacing-inconsistency`. LLM categorization has grouped them into a "Spacing Changes" bucket.

**Steps:**

1. Marcus opens the run results page.
2. He sees a banner: *"AI detected 5 spacing changes, likely from a grid migration. Approve all?"*
3. He reads the category summary: *"All 5 affected components have increased margin by 4 px — consistent with a 4px → 8px grid change."*
4. He clicks **"Approve All Spacing Changes"**.
5. A confirmation dialog lists the 5 findings by selector and asks: *"Mark all 5 as Acknowledged?"*
6. He clicks **Confirm**.
7. All 5 findings update to `acknowledged` status simultaneously.
8. The run summary bar updates: `5 / 7 reviewed`.

**API verification:**
```
PATCH /api/runs/:id/findings/bulk-review
Body: { "findingIds": ["...", "..."], "status": "acknowledged", "note": "Grid migration 4px → 8px" }
```
Response: `{ "updated": 5 }`

**Expected outcomes:**
- All 5 `PATCH` operations are atomic — either all succeed or the API returns an error.
- `GET /api/runs/:id/findings?reviewStatus=acknowledged` returns exactly 5 results.
- The UI updates all 5 badges in a single re-render (no flicker, no partial state visible to the user).

---

### B-06 — Multi-Theme / Dark Mode Native Support

**Spec file:** `odqa-050.dark-mode.spec.ts`
**Run script:**
```jsonc
"test:dark-mode": "playwright test --grep \"ODQA-050\""
```

---

#### ODQA-050 — Priya audits her app in light and dark mode in a single run submission

**Persona:** Priya (her app supports `prefers-color-scheme: dark` — she wants to know if the dark mode broke anything)

**Steps:**

1. Priya submits a new audit via the form.
2. She toggles **"Capture Themes"** and sees two theme rows appear:
   - **Light** (`prefers-color-scheme: light`) — selected by default
   - **Dark** (`prefers-color-scheme: dark`) — she enables this
3. She submits.
4. The run progress screen shows two sets of viewport progress bars: one labelled "Light" and one "Dark".
5. Both complete. The results page shows a **Theme Comparison** tab.
6. She clicks the tab. A side-by-side diff shows the light and dark screenshots of the same page.
7. She spots a contrast issue in the dark mode card text — highlighted with a red border overlay.
8. The finding panel confirms a `contrast-warning` finding scoped to `theme: dark`.

**Expected outcomes:**
- `GET /api/runs/:id/findings?theme=dark` returns findings scoped to the dark capture only.
- `GET /api/runs/:id/findings?theme=light` returns findings from the light capture only.
- The light and dark screenshots are different images (pixel diff > 0 between them).
- Findings from the dark theme do not appear in light theme queries and vice versa.

---

## Phase C — High Effort / Strategic

> These test cases are high-level behaviour specifications. Detailed implementation-level tests will be written at the time each feature is built. The descriptions here serve as acceptance criteria.

---

### C-01 — Design Token Validation

**Spec file:** `odqa-051.design-tokens.spec.ts` *(to be written at build time)*

#### ODQA-051 — Lena uploads a Style Dictionary token file and catches a token drift

**Persona:** Lena
**Setup:** A token file `tokens.json` contains `{ "--color-primary": "#3B82F6" }`. The live page uses `#2563EB` on the primary button.

**Acceptance criteria:**
1. Lena uploads `tokens.json` via the New Audit form.
2. The run completes. A `token-drift` finding is present.
3. The finding reads: *"Button (.btn-primary) uses #2563EB but --color-primary token is #3B82F6."*
4. No false positives fire on components that correctly use the token value.

---

### C-02 — Core Web Vitals Correlation

**Spec file:** `odqa-052.core-web-vitals.spec.ts` *(to be written at build time)*

#### ODQA-052 — Priya sees a CLS regression flagged alongside a banner animation visual diff

**Acceptance criteria:**
1. Run completes. A finding is present for a visual change AND a `performanceMetrics` object is attached to the viewport run.
2. `performanceMetrics.cls` value is > 0.1 (regression threshold).
3. The UI shows a "⚠ CLS Regression: 0.15" badge next to the visual diff.

---

### C-03 — Animation / Motion Regression Testing

**Spec file:** `odqa-053.animation-testing.spec.ts` *(to be written at build time)*

#### ODQA-053 — A CSS animation easing change is caught as a filmstrip regression

**Acceptance criteria:**
1. A run is submitted with `captureAnimation: true`.
2. The filmstrip for the `.hero-fade-in` animation shows a deviation at frame 4 of 10.
3. An `AnimationFinding` is returned with `findingType: "animation"`, `frameIndex: 4`, and a diff image attached.

---

### C-04 — Plugin API & Rule Authoring SDK

**Spec file:** `odqa-054.plugin-sdk.spec.ts` *(to be written at build time)*

#### ODQA-054 — A custom rule loaded from `opendesign.config.ts` fires during a run

**Acceptance criteria:**
1. A workspace `opendesign.config.ts` exports a custom rule that flags any element with `font-size < 12px`.
2. The run discovers the custom rule, runs it, and returns a finding with the custom rule's `id`.
3. Removing the config file causes the custom rule finding to disappear from the next run.

---

### C-05 — Usage-Based Transparent Pricing Infrastructure

**Spec file:** `odqa-055.usage-billing.spec.ts` *(to be written at build time)*

#### ODQA-055 — A project's snapshot counter increments correctly and Stripe is notified

**Acceptance criteria:**
1. A project starts at `snapshotsUsed = 0`.
2. A 3-viewport run completes, capturing 3 screenshots. `snapshotsUsed` becomes `3`.
3. When `snapshotsUsed` exceeds 5,000 the Stripe Meter API mock receives a `POST /v1/billing/meter_events` call with the correct quantity.
4. The usage dashboard in the web app renders a progress bar showing "X / 5,000 free snapshots used."

---

## Story Tests

These full end-to-end journey tests weave multiple features together in a single realistic scenario. They are run in headed mode with `slowMo` to serve as living demos.

---

### Story 2 — Lena's Compliance Audit Journey

**Spec file:** `odqa-story-2.lena-compliance-journey.spec.ts`
**Run script:**
```jsonc
"test:story:lena": "playwright test --grep \"Story 2\""
"test:story:lena:headed": "cross-env SLOW_MO=700 playwright test --headed --grep \"Story 2\""
```

**Scenario:** Lena is preparing a WCAG 2.1 AA compliance report for a healthcare portal ahead of a regulatory audit. She has 90 minutes to check the entire checkout flow.

**Acts:**

| # | Act | Features exercised |
|---|-----|--------------------|
| 1 | Lena opens OpenDesign QA. She starts a new audit against `/checkout` with `mobile`, `tablet`, `desktop`. | Core |
| 2 | The run completes. She opens findings and clicks "Filter: Accessibility Only". | A-01 |
| 3 | She expands a `color-contrast` finding. She sees the WCAG rule ID, impact `serious`, affected node HTML, and the help URL. | A-01 |
| 4 | She opens the help URL — it takes her to the axe-core contrast guidance page. | A-01 |
| 5 | She reads the suggested fix: *"Increase contrast ratio to 4.5:1 — consider using #1D4ED8."* | A-02 |
| 6 | She marks the finding **Acknowledged** and adds a note: *"Filed in ticket HEAL-301. Devs fixing in next sprint."* | A-03 |
| 7 | She runs `odqa run /checkout --output compliance-report.json` from her terminal to get a portable report. | A-06 |
| 8 | She emails `compliance-report.json` to the legal team. The file includes all findings with WCAG tags. | A-06 |

---

### Story 3 — Marcus's Slack-First Review Journey

**Spec file:** `odqa-story-3.marcus-slack-review.spec.ts`
**Run script:**
```jsonc
"test:story:marcus": "playwright test --grep \"Story 3\""
"test:story:marcus:headed": "cross-env SLOW_MO=700 playwright test --headed --grep \"Story 3\""
```

**Scenario:** Marcus's team runs CI on every PR. He never visits the web UI — he reviews every run from Slack on his phone.

**Acts:**

| # | Act | Features exercised |
|---|-----|--------------------|
| 1 | A CI pipeline submits a run via `POST /api/runs`. Marcus is in a meeting. | Core |
| 2 | The run completes. Slack mock server receives a Block Kit message within 3 s. | A-05 |
| 3 | The message shows: 0 critical, 2 high, 4 medium. Run URL is clickable. | A-05 |
| 4 | Marcus taps "View Report" in Slack. He lands on the run results page. | A-05 |
| 5 | He opens the two high-severity findings. Both have `suggestedFix` text he can forward to engineers. | A-02 |
| 6 | He marks both findings **Acknowledged** directly from the web UI. | A-03 |
| 7 | He closes the tab. He never had to search for the run — the Slack link took him straight there. | A-03 + A-05 |

---

### Story 4 — Dev's CI Pipeline Integration Journey

**Spec file:** `odqa-story-4.dev-ci-pipeline.spec.ts`
**Run script:**
```jsonc
"test:story:dev-ci": "playwright test --grep \"Story 4\""
"test:story:dev-ci:headed": "cross-env SLOW_MO=600 playwright test --headed --grep \"Story 4\""
```

**Scenario:** Dev is setting up OpenDesign QA in a GitHub Actions workflow. She wants the pipeline to fail if there are critical issues, and to post a JSON report as a CI artifact.

**Acts:**

| # | Act | Features exercised |
|---|-----|--------------------|
| 1 | Dev runs `odqa run http://staging.example.com --viewport mobile,tablet,desktop --output report.json`. | A-06 |
| 2 | CLI prints progress. Run completes in under 60 s. | A-06 |
| 3 | `report.json` is written. Dev checks `cat report.json \| jq '.findings \| length'` — shows 6. | A-06 |
| 4 | CLI exit code is `1` (2 high findings present). The GitHub Action step fails with a clear message. | A-06 |
| 5 | Dev adds `--no-fail-on-high` flag. Re-runs. Exit code is `0`. The CI step passes. The report is still written. | A-06 |
| 6 | Dev opens the run URL from the CLI output in a browser — sees the full results page. | Core + A-06 |

---

## Environment Variables Reference

| Variable | Required by | Test behaviour when absent |
|----------|-------------|---------------------------|
| `SLACK_WEBHOOK_URL` | A-05 | `notifySlack` is a no-op; ODQA-039 asserts zero mock calls |
| `OPENAI_API_KEY` | A-04 | `aiSummary` is null; ODQA-037b asserts graceful skip |
| `ANTHROPIC_API_KEY` | A-04 | Same as above |
| `JIRA_BASE_URL` / `JIRA_API_TOKEN` | B-01 | Create-ticket endpoint returns `424 Dependency Failed` |
| `LINEAR_API_KEY` | B-01 | Same as above |
| `WEB_BASE_URL` | A-05, A-06 | Falls back to `http://localhost:3000` |
| `API_URL` | A-06 CLI | Defaults to `http://localhost:3001` |

---

## Test Data Fixtures Required

| Fixture | Location | Purpose |
|---------|----------|---------|
| `test-landing` page with deliberate WCAG violations | `apps/web/public/fixtures/test-landing` | A-01, A-02, Story 2 |
| `test-landing` page with countdown timer (known false positive) | Same file, existing `.countdown-timer` element | B-02 |
| `tokens.json` Style Dictionary export | `e2e/fixtures/tokens.json` | C-01 |
| Slack mock server helper | `e2e/helpers/slack-mock-server.ts` | A-05, Story 3 |
| Jira / Linear WireMock stubs | `e2e/helpers/ticket-stubs.ts` | B-01 |

---

## Progress Tracker

| Test ID | Feature | Spec File | Status |
|---------|---------|-----------|--------|
| ODQA-032 | A-01 Accessibility overlay — violations present | `odqa-032-033.accessibility-overlay.spec.ts` | ⬜ |
| ODQA-033 | A-01 Accessibility + visual findings co-exist | `odqa-032-033.accessibility-overlay.spec.ts` | ⬜ |
| ODQA-034 | A-02 suggestedFix present on all rule findings | `odqa-034.root-cause-hints.spec.ts` | ⬜ |
| ODQA-035 | A-03 Acknowledge a finding with note | `odqa-035-036.review-workflow.spec.ts` | ⬜ |
| ODQA-036 | A-03 Bulk status changes + filter by status | `odqa-035-036.review-workflow.spec.ts` | ⬜ |
| ODQA-037a | A-04 AI summary present when key is set | `odqa-037.ai-diff-summary.spec.ts` | ⬜ |
| ODQA-037b | A-04 Run completes without LLM key | `odqa-037.ai-diff-summary.spec.ts` | ⬜ |
| ODQA-038 | A-05 Slack receives Block Kit message | `odqa-038-039.slack-notifications.spec.ts` | ⬜ |
| ODQA-039 | A-05 Run completes without Slack webhook | `odqa-038-039.slack-notifications.spec.ts` | ⬜ |
| ODQA-040 | A-06 CLI colored output + exit code | `odqa-040-042.cli.spec.ts` | ⬜ |
| ODQA-041 | A-06 CLI `--output` saves valid JSON | `odqa-040-042.cli.spec.ts` | ⬜ |
| ODQA-042 | A-06 CLI user-friendly error on bad API | `odqa-040-042.cli.spec.ts` | ⬜ |
| ODQA-043 | A-07 Breakpoint matrix — 3 tiles visible | `odqa-043.breakpoint-matrix.spec.ts` | ⬜ |
| ODQA-044 | B-01 Jira ticket created from finding | `odqa-044-045.jira-linear.spec.ts` | ⬜ |
| ODQA-045 | B-01 Linear issue created from finding | `odqa-044-045.jira-linear.spec.ts` | ⬜ |
| ODQA-046 | B-02 Ignore rule suppresses finding in next run | `odqa-046.ignore-rules.spec.ts` | ⬜ |
| ODQA-047 | B-03 WebKit run produces different findings | `odqa-047.cross-browser.spec.ts` | ⬜ |
| ODQA-048 | B-04 Low sensitivity suppresses noise | `odqa-048.sensitivity-presets.spec.ts` | ⬜ |
| ODQA-049 | B-05 Bulk approval via AI categorization | `odqa-049.batch-approval.spec.ts` | ⬜ |
| ODQA-050 | B-06 Dark mode findings are theme-scoped | `odqa-050.dark-mode.spec.ts` | ⬜ |
| ODQA-051 | C-01 Token drift finding | `odqa-051.design-tokens.spec.ts` | ⬜ |
| ODQA-052 | C-02 CLS regression badge in UI | `odqa-052.core-web-vitals.spec.ts` | ⬜ |
| ODQA-053 | C-03 Filmstrip animation regression | `odqa-053.animation-testing.spec.ts` | ⬜ |
| ODQA-054 | C-04 Custom rule from plugin fires | `odqa-054.plugin-sdk.spec.ts` | ⬜ |
| ODQA-055 | C-05 Snapshot counter + Stripe meter | `odqa-055.usage-billing.spec.ts` | ⬜ |
| Story 2 | Lena compliance journey | `odqa-story-2.lena-compliance-journey.spec.ts` | ⬜ |
| Story 3 | Marcus Slack-first review | `odqa-story-3.marcus-slack-review.spec.ts` | ⬜ |
| Story 4 | Dev CI pipeline integration | `odqa-story-4.dev-ci-pipeline.spec.ts` | ⬜ |
