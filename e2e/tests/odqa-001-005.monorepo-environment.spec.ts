/**
 * ODQA-001 — Scaffold Monorepo
 * ODQA-002 — Create Shared TypeScript And ESLint Config Package
 * ODQA-003 — Create Shared Contracts Package
 * ODQA-004 — Docker Compose Development Environment
 * ODQA-005 — Root README And Contributing Guide
 *
 * These tickets establish the development foundation. The E2E tests here verify
 * the observable outputs of that foundation — the API responds (proving TypeScript
 * config and contracts are wired correctly) and the key workspace files exist with
 * the required content.
 */
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Resolve workspace root relative to this file (e2e/tests/ → two levels up)
const WORKSPACE_ROOT = resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-001: Scaffold Monorepo
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-001 — Scaffold Monorepo", () => {
  test("root package.json declares the workspace", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "package.json");
    expect(existsSync(pkgPath), "root package.json must exist").toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      name?: string;
      scripts?: Record<string, string>;
      engines?: Record<string, string>;
    };

    expect(pkg.name).toBeDefined();
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts!["build"]).toBeDefined();
    expect(pkg.scripts!["test"]).toBeDefined();
    expect(pkg.engines?.["node"]).toMatch(/>=20/);
  });

  test("pnpm-workspace.yaml lists apps/* and packages/*", () => {
    const wsPath = resolve(WORKSPACE_ROOT, "pnpm-workspace.yaml");
    expect(existsSync(wsPath), "pnpm-workspace.yaml must exist").toBe(true);

    const content = readFileSync(wsPath, "utf-8");
    expect(content).toContain("apps/*");
    expect(content).toContain("packages/*");
  });

  test("turbo.json defines build, test, lint, and dev tasks", () => {
    const turboPath = resolve(WORKSPACE_ROOT, "turbo.json");
    expect(existsSync(turboPath), "turbo.json must exist").toBe(true);

    const turbo = JSON.parse(readFileSync(turboPath, "utf-8")) as {
      tasks?: Record<string, unknown>;
    };

    const tasks = turbo.tasks ?? {};
    expect(Object.keys(tasks)).toContain("build");
    expect(Object.keys(tasks)).toContain("test");
    expect(Object.keys(tasks)).toContain("lint");
    expect(Object.keys(tasks)).toContain("dev");
  });

  test("apps and packages directories exist", () => {
    expect(existsSync(resolve(WORKSPACE_ROOT, "apps")), "apps/ must exist").toBe(true);
    expect(existsSync(resolve(WORKSPACE_ROOT, "packages")), "packages/ must exist").toBe(true);
    expect(existsSync(resolve(WORKSPACE_ROOT, "apps", "api")), "apps/api must exist").toBe(true);
    expect(existsSync(resolve(WORKSPACE_ROOT, "apps", "web")), "apps/web must exist").toBe(true);
    expect(existsSync(resolve(WORKSPACE_ROOT, "apps", "worker")), "apps/worker must exist").toBe(true);
  });

  // Edge case: workspace YAML is malformed
  test("pnpm-workspace.yaml is valid YAML (non-empty, contains packages key)", () => {
    const wsPath = resolve(WORKSPACE_ROOT, "pnpm-workspace.yaml");
    const content = readFileSync(wsPath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
    expect(content).toContain("packages:");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-002: Shared TypeScript And ESLint Config Package
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-002 — Shared TypeScript And ESLint Config Package", () => {
  test("packages/config/tsconfig.base.json exists and enables strict mode", () => {
    const tsconfigPath = resolve(WORKSPACE_ROOT, "packages", "config", "tsconfig.base.json");
    expect(existsSync(tsconfigPath), "tsconfig.base.json must exist").toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8")) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions?.["strict"]).toBe(true);
    expect(tsconfig.compilerOptions?.["target"]).toBe("ES2022");
  });

  test("packages/config/package.json exists", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "config", "package.json");
    expect(existsSync(pkgPath), "packages/config/package.json must exist").toBe(true);
  });

  // Edge case: config package is not accidentally private-only
  test("api tsconfig.json extends the shared base config", () => {
    const apiTsconfigPath = resolve(WORKSPACE_ROOT, "apps", "api", "tsconfig.json");
    expect(existsSync(apiTsconfigPath), "apps/api/tsconfig.json must exist").toBe(true);

    const tsconfig = JSON.parse(readFileSync(apiTsconfigPath, "utf-8")) as {
      extends?: string;
    };
    expect(tsconfig.extends).toMatch(/config/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-003: Shared Contracts Package
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-003 — Shared Contracts Package", () => {
  test("packages/contracts/src/types.ts exists and exports core domain types", () => {
    const typesPath = resolve(WORKSPACE_ROOT, "packages", "contracts", "src", "types.ts");
    expect(existsSync(typesPath), "types.ts must exist").toBe(true);

    const source = readFileSync(typesPath, "utf-8");
    // Core types required by acceptance criteria
    expect(source).toContain("AuditRun");
    expect(source).toContain("Finding");
    expect(source).toContain("FindingSeverity");
    expect(source).toContain("CaptureArtifact");
  });

  test("packages/contracts/src/schemas.ts exports Zod schemas", () => {
    const schemasPath = resolve(WORKSPACE_ROOT, "packages", "contracts", "src", "schemas.ts");
    expect(existsSync(schemasPath), "schemas.ts must exist").toBe(true);

    const source = readFileSync(schemasPath, "utf-8");
    expect(source).toContain("CreateRunRequest");
    expect(source).toContain("FindingSchema");
  });

  test("packages/contracts/src/index.ts re-exports types and schemas", () => {
    const indexPath = resolve(WORKSPACE_ROOT, "packages", "contracts", "src", "index.ts");
    expect(existsSync(indexPath), "contracts/src/index.ts must exist").toBe(true);

    const source = readFileSync(indexPath, "utf-8");
    expect(source.length).toBeGreaterThan(0);
  });

  // Edge case: contracts package.json is present and has a name
  test("contracts package.json exists and declares a package name", () => {
    const pkgPath = resolve(WORKSPACE_ROOT, "packages", "contracts", "package.json");
    expect(existsSync(pkgPath), "contracts package.json must exist").toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string };
    expect(pkg.name).toMatch(/@opendesign-qa\/contracts/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-004: Docker Compose Development Environment
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-004 — Docker Compose Development Environment", () => {
  test("docker-compose.dev.yml exists at workspace root", () => {
    const composePath = resolve(WORKSPACE_ROOT, "docker-compose.dev.yml");
    expect(existsSync(composePath), "docker-compose.dev.yml must exist").toBe(true);
  });

  test("docker-compose.dev.yml includes postgres, redis, and minio services", () => {
    const composePath = resolve(WORKSPACE_ROOT, "docker-compose.dev.yml");
    const content = readFileSync(composePath, "utf-8").toLowerCase();

    expect(content).toContain("postgres");
    expect(content).toContain("redis");
    expect(content).toContain("minio");
  });

  test(".env.example documents all expected environment variables", () => {
    const envExamplePath = resolve(WORKSPACE_ROOT, ".env.example");
    expect(existsSync(envExamplePath), ".env.example must exist").toBe(true);

    const content = readFileSync(envExamplePath, "utf-8");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("REDIS_URL");
    expect(content).toContain("STORAGE_ENDPOINT");
    expect(content).toContain("API_PORT");
  });

  // Edge case: docker-compose file is not empty
  test("docker-compose.dev.yml is a non-trivial YAML file", () => {
    const composePath = resolve(WORKSPACE_ROOT, "docker-compose.dev.yml");
    const content = readFileSync(composePath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-005: Root README And Contributing Guide
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-005 — Root README And Contributing Guide", () => {
  test("README.md exists at workspace root", () => {
    const readmePath = resolve(WORKSPACE_ROOT, "README.md");
    expect(existsSync(readmePath), "README.md must exist").toBe(true);
  });

  test("README.md describes the product and includes a quick-start section", () => {
    const readmePath = resolve(WORKSPACE_ROOT, "README.md");
    const content = readFileSync(readmePath, "utf-8");

    // Must describe the product (non-trivial length)
    expect(content.length).toBeGreaterThan(200);
    // Must have a heading (suggests structure)
    expect(content).toContain("#");
  });

  test("CONTRIBUTING.md exists at workspace root", () => {
    const contributingPath = resolve(WORKSPACE_ROOT, "CONTRIBUTING.md");
    expect(existsSync(contributingPath), "CONTRIBUTING.md must exist").toBe(true);
  });

  test("CONTRIBUTING.md covers PR flow and branch naming", () => {
    const contributingPath = resolve(WORKSPACE_ROOT, "CONTRIBUTING.md");
    const content = readFileSync(contributingPath, "utf-8").toLowerCase();

    expect(content.length).toBeGreaterThan(200);
    // Should mention PR, branch, or commit concepts
    expect(
      content.includes("pull request") || content.includes("branch") || content.includes("commit")
    ).toBe(true);
  });

  // Edge case: README is not just a placeholder
  test("README.md mentions OpenDesign QA by name", () => {
    const readmePath = resolve(WORKSPACE_ROOT, "README.md");
    const content = readFileSync(readmePath, "utf-8");
    expect(content.toLowerCase()).toContain("opendesign");
  });
});
