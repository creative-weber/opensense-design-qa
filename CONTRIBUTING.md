# Contributing to OpenDesign QA

Thank you for your interest in contributing. This document covers the development workflow, conventions, and how to add a new audit rule.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Branch Naming](#branch-naming)
3. [Commit Style](#commit-style)
4. [Pull Request Flow](#pull-request-flow)
5. [Testing Requirements](#testing-requirements)
6. [How to Add a Rule](#how-to-add-a-rule)

---

## Development Setup

Follow the [Quick Start](./README.md#quick-start-local-development) in the README to get your local environment running.

Key commands:

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm test:coverage    # Run tests with coverage report
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
```

---

## Branch Naming

Use the following prefixes:

| Prefix      | When to use                          | Example                          |
|-------------|--------------------------------------|----------------------------------|
| `feat/`     | New feature or story                 | `feat/odqa-007-screenshot-capture` |
| `fix/`      | Bug fix                              | `fix/odqa-023-overflow-false-positive` |
| `chore/`    | Non-feature work (config, deps, CI)  | `chore/update-playwright`        |
| `docs/`     | Documentation only                   | `docs/rule-authoring-guide`      |
| `refactor/` | Code restructure with no behaviour change | `refactor/capture-error-types` |
| `test/`     | Adding or fixing tests only          | `test/odqa-029-contrast-edge-cases` |

Branch names must be lowercase and use hyphens.

---

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer — e.g. Closes #123]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`.

Scope is the ticket number or package name:

```
feat(odqa-007): implement single-page screenshot capture
fix(rules-web): skip overflow check on scroll containers
test(contracts): add edge cases for CreateRunSchema
chore(deps): upgrade playwright to 1.50
```

Keep the short description under 72 characters. Use the imperative mood: "add", "fix", "remove" — not "added", "fixes", "removed".

---

## Pull Request Flow

1. Create a branch from `main` with the correct prefix and ticket number.
2. Keep PRs focused — one ticket per PR unless tickets are tightly coupled.
3. Fill in the PR template (summary, testing notes, screenshots if UI).
4. All CI checks must be green before requesting review:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test:coverage` (≥ 90 % line and branch coverage)
5. At least one approval is required before merging.
6. Merge using **squash and merge**. The squash commit message must follow Conventional Commits.
7. Delete the branch after merging.

**No PR is accepted if any test is red or coverage drops below 90 %.**

---

## Testing Requirements

Every ticket that produces runnable code must ship with:

- **Unit or integration tests** co-located with the source file (`*.test.ts`).
- **E2E tests** in `e2e/tests/` covering at least the happy path and one failure/edge case for every user-facing feature.

Coverage threshold: **≥ 90 % line and branch coverage** across all changed packages.

Run tests before pushing:

```bash
pnpm test:coverage
```

---

## How to Add a Rule

Rules live in `packages/rules-web/src/rules/`. Each rule is a TypeScript file exporting an object that satisfies the `Rule` interface from `@opendesign-qa/rules-core`.

### Step-by-step

1. **Create the rule file**

   ```
   packages/rules-web/src/rules/my-new-rule.ts
   ```

2. **Implement the `Rule` interface**

   ```typescript
   import type { Rule } from "@opendesign-qa/rules-core";

   export const myNewRule: Rule = {
     id: "web/my-new-rule",
     name: "My New Rule",
     severity: "medium",
     run(snapshot) {
       // snapshot is a DomSnapshot[] — an array of visible elements with
       // bounding boxes and computed styles.
       const results = [];
       // ... detection logic ...
       return results;
     },
   };
   ```

3. **Register the rule** in `packages/rules-web/src/index.ts`:

   ```typescript
   export { myNewRule } from "./rules/my-new-rule.js";
   ```

4. **Write tests** in `packages/rules-web/src/rules/my-new-rule.test.ts`:
   - Happy path: the rule detects the defect on a fixture snapshot.
   - False-positive path: the rule does NOT fire on a valid snapshot.
   - Edge cases: empty snapshot, single element, etc.

5. **Check severity guidance** in the `FindingSeverity` type (`packages/contracts/src/types.ts`).

6. **Update the rule catalogue** in `docs/rules.md` with the rule ID, name, description, and evidence fields.

See existing rules (`overflow.ts`, `contrast.ts`) for reference implementations.

---

## Questions?

Open a GitHub Discussion or ping the maintainers in the issue tracker.
