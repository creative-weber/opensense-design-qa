# OpenDesign QA First-Time User Guide

This guide is for someone opening OpenDesign QA for the first time and wanting a clear path from setup to the first click through the app.

---

## What OpenDesign QA Does

OpenDesign QA is a local-first visual design QA platform. Its long-term goal is to let you:

1. Audit a live public page for visual defects.
2. Compare an implemented page with a Figma frame.
3. Review evidence-backed findings and export reports.

At the moment, the application is in an early MVP stage. The web app shell is available, and the main user flow currently takes you from the home page to the New Audit screen. The actual audit submission form is not implemented yet, so this guide focuses on the working first-run experience that exists today.

---

## Before You Start

Make sure you have these installed:

1. Node.js 20 or newer.
2. pnpm 9 or newer.
3. Docker 24 or newer.

You will also need a terminal in the repository root.

---

## First Launch

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create your environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash or other POSIX-style shells:

```bash
cp .env.example .env
```

The default values are designed to work with the local Docker setup.

### 3. Start the local services

```bash
docker compose -f docker-compose.dev.yml up -d
```

This brings up the local infrastructure used by the app:

| Service | Default port | Why it exists |
|---|---:|---|
| PostgreSQL | 5432 | Stores application data |
| Redis | 6379 | Supports queued background work |
| MinIO | 9000 | Stores screenshots and other artifacts |
| MinIO Console | 9001 | Lets you inspect stored artifacts in the browser |

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Seed sample data if you want a fuller local setup

```bash
pnpm db:seed
```

This step is optional.

### 6. Start the application

```bash
pnpm dev
```

That starts the monorepo development processes together. If you prefer to run them separately, use:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

---

## Local URLs You Will Use

Once the services are running, these are the main local entry points:

| URL | What you should expect |
|---|---|
| `http://localhost:3000` | Main web application |
| `http://localhost:3000/runs/new` | New Audit screen |
| `http://localhost:3001/health` | API health check |
| `http://localhost:9001` | MinIO browser console |

If `http://localhost:3001/health` responds successfully, the API is up.

---

## Your First Walkthrough

### Step 1. Open the home page

Go to `http://localhost:3000`.

You should see:

1. The OpenDesign QA product name.
2. A short description of the platform.
3. A `Start New Audit` button.
4. A top navigation bar with a `New Audit` link.

If you do not see that shell, the web app has not started correctly.

### Step 2. Open the New Audit screen

Click `Start New Audit`, or use the `New Audit` link in the top navigation.

You should land on `http://localhost:3000/runs/new`.

### Step 3. Understand the current product state

The New Audit page currently shows a placeholder message indicating that the audit form is still in progress.

That means the current first-time experience is mainly about confirming that:

1. The web shell loads.
2. Navigation works.
3. The local API and worker stack are available for ongoing development.

---

## Built-In Demo Pages

While the audit submission UI is still being built, the app includes fixture pages that are useful for understanding the kinds of defects OpenDesign QA is designed to inspect.

Try these routes in your browser:

1. `http://localhost:3000/fixtures/clean`
2. `http://localhost:3000/fixtures/overflow`
3. `http://localhost:3000/fixtures/overlap`
4. `http://localhost:3000/fixtures/alignment-drift`
5. `http://localhost:3000/fixtures/spacing-inconsistency`
6. `http://localhost:3000/fixtures/typography-inconsistency`
7. `http://localhost:3000/fixtures/color-mismatch`
8. `http://localhost:3000/fixtures/contrast`
9. `http://localhost:3000/fixtures/contrast-large-text`

These fixture pages are intentionally simple. They exist to exercise the underlying capture and rule-detection pipeline during development.

---

## What A First-Time User Can Do Today

Today you can reliably:

1. Run the full local stack.
2. Open the web app.
3. Navigate from the landing page to the New Audit route.
4. Inspect fixture pages that represent common visual QA defects.
5. Verify the API health endpoint.

Today you cannot yet:

1. Submit a real audit from the web UI.
2. Upload or connect a Figma frame from the web UI.
3. Review a completed report in the web app.
4. Export results from the UI.

That distinction matters because it sets the right expectation for first-time evaluation.

---

## Recommended First Session

If you want the shortest useful first session, follow this sequence:

1. Run `pnpm install`.
2. Start Docker services.
3. Run `pnpm db:migrate`.
4. Start the app with `pnpm dev`.
5. Open `http://localhost:3000`.
6. Click `Start New Audit`.
7. Visit `http://localhost:3000/fixtures/overflow` and `http://localhost:3000/fixtures/contrast` to see example defect pages.
8. Check `http://localhost:3001/health` to confirm the API is healthy.

If all of those steps work, your local OpenDesign QA environment is ready for further development and testing.

---

## Common Problems

### The web app does not open on port 3000

Check whether `pnpm dev` is still running and whether another process is already using port 3000.

### The API health check fails

Make sure the API process started successfully and that your Docker services are up, especially PostgreSQL and Redis.

### Database commands fail

Make sure Docker is running and that `docker compose -f docker-compose.dev.yml up -d` completed without errors before running migrations.

### The New Audit page looks empty

That is expected right now. The route exists, but the actual audit form has not been shipped yet.

---

## Where To Go Next

1. Read the [README](./README.md) for the full development setup and command list.
2. Read the [MVP specification](./OSS_DESIGN_QA_MVP_SPEC.md) to understand the intended end-state of the product.
3. Read [CONTRIBUTING.md](./CONTRIBUTING.md) if you want to help implement the next user-facing flow.