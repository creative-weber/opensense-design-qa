# OpenDesign QA

Open-source visual design QA platform. Audit live websites for design defects and compare pages against Figma frames with pixel-level diffing. Produces evidence-backed, exportable reports.

---

## Quick Start (Local Development)

Looking for a product-oriented walkthrough instead of setup steps? See the [First-Time User Guide](./FIRST_TIME_USER_GUIDE.md).

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9
- [Docker](https://www.docker.com/) ≥ 24

### 1 — Clone and install

```bash
git clone https://github.com/your-org/opendesign-qa.git
cd opendesign-qa
pnpm install
```

### 2 — Copy environment variables

```bash
cp .env.example .env
```

Edit `.env` if you need to change any defaults (the defaults work with Docker Compose out of the box).

### 3 — Start dev infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:

| Service    | Port | Purpose                      |
|------------|------|------------------------------|
| PostgreSQL | 5432 | Primary database             |
| Redis      | 6379 | Job queue (BullMQ)           |
| MinIO      | 9000 | S3-compatible artifact store |
| MinIO UI   | 9001 | MinIO web console            |

### 4 — Run database migrations

```bash
pnpm db:migrate
```

### 5 — Seed sample data (optional)

```bash
pnpm db:seed
```

### 6 — Start all services

```bash
# All services in parallel (uses Turborepo)
pnpm dev

# Or individually
pnpm dev:api      # API on http://localhost:3001
pnpm dev:worker   # Background worker
pnpm dev:web      # Web app on http://localhost:3000
```

---

## Repository Structure

```
opendesign-qa/
├── apps/
│   ├── api/        — Fastify REST API (health + run/project endpoints)
│   ├── web/        — Next.js 16 report UI (Tailwind v4, TanStack Query)
│   └── worker/     — BullMQ job worker (Playwright capture + rule engine)
├── packages/
│   ├── config/     — Shared TypeScript and ESLint config
│   ├── contracts/  — Shared Zod schemas and TypeScript types
│   ├── db/         — Prisma schema and database client (PostgreSQL)
│   ├── storage/    — S3-compatible object storage adapter (MinIO / AWS S3)
│   ├── capture/    — Playwright capture pipeline  [Sprint 1]
│   ├── rules-core/ — Rule framework and execution harness  [Sprint 2]
│   ├── rules-web/  — Built-in web audit rules  [Sprint 2–3]
│   ├── compare/    — Pixel-diff and block-level comparison engine  [Sprint 5]
│   ├── figma/      — Figma API client and normaliser  [Sprint 4]
│   └── reporting/  — JSON and Markdown report generators  [Sprint 4]
├── e2e/            — End-to-end Playwright tests
├── examples/       — Sample report exports
├── docker-compose.dev.yml
└── .env.example
```

> Packages marked `[Sprint N]` are planned but not yet implemented. See the [Scrum Plan](./OSS_DESIGN_QA_SCRUM_PLAN.md) for the full roadmap.

---

## Using The App

If this is your first time opening OpenDesign QA, start with the [First-Time User Guide](./FIRST_TIME_USER_GUIDE.md). It explains what is available today, how to launch the app locally, and what you should expect from the current UI.

---

## Running Tests

```bash
# Default test run (unit/integration across apps/packages; skips e2e)
pnpm test

# Full monorepo test run (includes e2e)
pnpm test:all

# With coverage report (≥ 90% line and branch coverage required)
pnpm test:coverage

# Single package
pnpm --filter @opendesign-qa/contracts test
pnpm --filter @opendesign-qa/api test
pnpm --filter @opendesign-qa/worker test
pnpm --filter @opendesign-qa/storage test
pnpm --filter @opendesign-qa/web test
```

For e2e browser coverage beyond Chrome, install additional Playwright browsers first:

```bash
cd e2e
pnpm exec playwright install
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT
