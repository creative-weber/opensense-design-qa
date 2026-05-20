# OpenDesign QA Monorepo Structure And Stack Recommendation

## Recommendation Summary

Use a TypeScript-first monorepo with separate apps for UI, API, and worker execution, plus shared packages for contracts, rules, capture, comparison, and UI primitives.

Recommended tooling:

1. pnpm workspaces.
2. Turborepo for task orchestration and caching.
3. TypeScript across all Node.js services.
4. Prisma with PostgreSQL.
5. Redis with BullMQ.
6. Playwright for capture.

## Why This Shape

1. The product needs multiple runtime surfaces with different scaling profiles.
2. Shared types and contracts must stay consistent between API, worker, CLI, and UI.
3. Rules and capture logic should be reusable in future CLI and CI integrations.
4. Open-source contributors benefit from clear package boundaries.

## Proposed Repository Layout

```text
opendesign-qa/
  apps/
    web/
    api/
    worker/
    docs/
  packages/
    config/
    contracts/
    db/
    ui/
    capture/
    figma/
    compare/
    rules-core/
    rules-web/
    reporting/
    cli-core/
  tooling/
    scripts/
    docker/
  examples/
    sample-config/
  .github/
    workflows/
  docs/
    architecture/
    contributing/
    decisions/
```

## App Responsibilities

### `apps/web`

Purpose:

1. User-facing dashboard.
2. Comparison viewer.
3. Report browsing and export.

Recommended stack:

1. Next.js.
2. TypeScript.
3. Tailwind CSS.
4. TanStack Query.

### `apps/api`

Purpose:

1. REST API for audit execution and report retrieval.
2. Auth, validation, persistence, and configuration.

Recommended stack:

1. Fastify.
2. Zod.
3. Prisma.

### `apps/worker`

Purpose:

1. Queue consumers.
2. Browser capture jobs.
3. Rule execution and comparison jobs.

Recommended stack:

1. Node.js runtime.
2. Playwright.
3. BullMQ.

### `apps/docs`

Purpose:

1. Public documentation site.
2. Contributor docs and plugin docs.
3. Demo reports and examples.

Recommended stack:

1. Docusaurus or Next.js content site.

## Package Responsibilities

### `packages/config`

1. Shared TypeScript, ESLint, Prettier, and environment config.

### `packages/contracts`

1. Shared API types, schemas, severity enums, and report models.

### `packages/db`

1. Prisma schema, migrations, and database client.

### `packages/ui`

1. Shared components and charting primitives for reports.

### `packages/capture`

1. Browser automation, waits, page stabilization, screenshots, and DOM extraction.

### `packages/figma`

1. Figma API client, frame normalization, and token-safe adapters.

### `packages/compare`

1. Pixel diffing, block matching, geometry scoring, and mismatch region generation.

### `packages/rules-core`

1. Rule engine, rule result schema, severity scoring, and plugin lifecycle.

### `packages/rules-web`

1. Built-in website-focused checks such as spacing, overflow, typography, and contrast.

### `packages/reporting`

1. Markdown export, JSON export, aggregation, and issue grouping.

### `packages/cli-core`

1. Shared logic for a later CLI surface.

## Infrastructure Recommendation

### Local Development

Use Docker Compose for support services:

1. PostgreSQL.
2. Redis.
3. MinIO for local object storage.

Run app processes via Turborepo tasks:

1. `pnpm dev:web`
2. `pnpm dev:api`
3. `pnpm dev:worker`

### Deployment Later

1. Web app on Vercel or a container platform.
2. API and worker on Fly.io, Railway, Render, or Kubernetes.
3. Managed PostgreSQL and Redis.
4. S3-compatible storage for artifacts.

## Stack Recommendation By Concern

### Frontend

Recommendation:

1. Next.js.
2. TypeScript.
3. Tailwind CSS.
4. Radix UI primitives where needed.

Reasoning:

1. Fast iteration.
2. Strong ecosystem.
3. Good documentation and community familiarity.

### Backend

Recommendation:

1. Node.js.
2. Fastify.
3. Prisma.
4. Zod.

Reasoning:

1. Shared language across services reduces contributor friction.
2. Fastify performs well and stays minimal.
3. Prisma accelerates schema evolution early.

### Browser And Visual Analysis

Recommendation:

1. Playwright.
2. Sharp.
3. Pixelmatch.
4. Optional OpenCV later for advanced comparison.

Reasoning:

1. Playwright is reliable and widely adopted.
2. Sharp plus Pixelmatch is enough to prove the first visual diff workflows.

### AI Layer

Recommendation:

1. Keep AI behind a provider abstraction.
2. Support provider opt-in instead of making it required.

Reasoning:

1. Open-source adopters may want a fully offline or non-AI mode.
2. Provider abstraction avoids deep vendor lock-in.

## Development Conventions

1. Every package must have a single clear ownership purpose.
2. Shared types live in contracts, not duplicated in apps.
3. Rules must be individually testable.
4. Capture logic must stay deterministic where possible.
5. Report schemas must be versioned.

## Suggested First Scaffolding Order

1. `packages/config`
2. `packages/contracts`
3. `packages/db`
4. `apps/api`
5. `apps/worker`
6. `packages/capture`
7. `packages/rules-core`
8. `packages/rules-web`
9. `apps/web`
10. `packages/reporting`

## Decisions To Revisit Later

1. Whether the API should move to GraphQL for complex report queries.
2. Whether the docs app should stay in-repo or be published separately.
3. Whether worker execution should evolve toward isolated sandbox containers per run.