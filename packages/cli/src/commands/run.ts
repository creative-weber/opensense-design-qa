/**
 * `odqa run <url>` command
 *
 * Flow:
 *  1. Resolve or create a project.
 *  2. POST /api/runs to create a new audit run.
 *  3. Poll /api/runs/:id every 2 s until a terminal status is reached.
 *  4. Fetch findings and print a severity-sorted summary.
 *  5. Optionally save the full report to a file.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import type { RunOptions } from "../index.js";

// ─── Terminal status predicates ───────────────────────────────────────────────

const TERMINAL_STATUSES = new Set([
  "complete",
  "rules_complete",
  "failed",
]);

// ─── Severity display helpers ─────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return pc.bgRed(pc.white(` ${severity.toUpperCase()} `));
    case "high": return pc.red(`[${severity.toUpperCase()}]`);
    case "medium": return pc.yellow(`[${severity.toUpperCase()}]`);
    case "low": return pc.cyan(`[${severity.toUpperCase()}]`);
    default: return pc.gray(`[${severity.toUpperCase()}]`);
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(apiBase: string, path: string): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status} on GET ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(apiBase: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status} on POST ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function ensureProject(apiBase: string, projectId?: string): Promise<string> {
  if (projectId) return projectId;

  // Create a temporary project named after the current timestamp
  const project = await apiPost<{ id: string }>(apiBase, "/api/projects", {
    name: `CLI run — ${new Date().toISOString()}`,
  });
  return project.id;
}

// ─── Poll helper ──────────────────────────────────────────────────────────────

async function pollUntilComplete(
  apiBase: string,
  runId: string,
  onProgress: (status: string) => void,
  intervalMs = 2000,
  maxWaitMs = 120_000
): Promise<{ status: string }> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const run = await apiGet<{ id: string; status: string }>(apiBase, `/api/runs/${runId}`);
    onProgress(run.status);
    if (TERMINAL_STATUSES.has(run.status)) return run;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for run ${runId} to complete (max ${maxWaitMs / 1000}s)`);
}

// ─── Main command ─────────────────────────────────────────────────────────────

export async function runCommand(url: string, options: RunOptions): Promise<void> {
  const apiBase = options.api.replace(/\/$/, "");
  const viewports = options.viewport
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  console.log();
  console.log(pc.bold("OpenDesign QA") + pc.gray(" — design quality audit"));
  console.log(pc.gray("─".repeat(55)));
  console.log(`  ${pc.bold("URL")}        ${pc.cyan(url)}`);
  console.log(`  ${pc.bold("Viewports")}  ${viewports.join(", ")}`);
  if (options.figma) {
    console.log(`  ${pc.bold("Figma")}      ${pc.magenta(options.figma)}`);
  }
  console.log(pc.gray("─".repeat(55)));
  console.log();

  // 1. Resolve project
  let projectId: string;
  try {
    process.stdout.write(pc.gray("  → ") + "Resolving project …");
    projectId = await ensureProject(apiBase, options.project);
    process.stdout.write("\r" + pc.green("  ✓ ") + `Project ready  ${pc.gray(projectId)}\n`);
  } catch (err) {
    process.stdout.write("\n");
    console.error(pc.red("  ✗ Failed to resolve project: ") + String(err));
    process.exit(1);
  }

  // 2. Create run
  let runId: string;
  try {
    process.stdout.write(pc.gray("  → ") + "Creating audit run …");
    const run = await apiPost<{ id: string }>(apiBase, "/api/runs", {
      projectId,
      url,
      viewports,
      figmaFrameUrl: options.figma ?? null,
    });
    runId = run.id;
    process.stdout.write("\r" + pc.green("  ✓ ") + `Run created    ${pc.gray(runId)}\n`);
  } catch (err) {
    process.stdout.write("\n");
    console.error(pc.red("  ✗ Failed to create run: ") + String(err));
    process.exit(1);
  }

  // 3. Poll for completion
  console.log();
  let lastStatus = "";
  try {
    const completedRun = await pollUntilComplete(
      apiBase,
      runId,
      (status) => {
        if (status !== lastStatus) {
          process.stdout.write("\r" + pc.gray("  ⏳ Status: ") + pc.yellow(status.padEnd(20)));
          lastStatus = status;
        }
      }
    );
    process.stdout.write("\n");
    const statusLabel = completedRun.status === "failed"
      ? pc.red("FAILED")
      : pc.green("COMPLETE");
    console.log(pc.gray("  → ") + `Run finished: ${statusLabel}`);
  } catch (err) {
    process.stdout.write("\n");
    console.error(pc.red("  ✗ Polling failed: ") + String(err));
    process.exit(1);
  }

  // 4. Fetch findings
  console.log();
  type Finding = { id: string; ruleId: string; title: string; severity: string; description: string };
  type FindingsResponse = { data: Finding[]; total: number };

  let findings: Finding[] = [];
  try {
    const res = await apiGet<FindingsResponse>(apiBase, `/api/runs/${runId}/findings?pageSize=100`);
    findings = res.data ?? [];
  } catch {
    console.log(pc.yellow("  ⚠  Could not fetch findings."));
  }

  // Sort by severity
  findings.sort((a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0));

  // Count by severity
  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log(pc.bold("  Summary"));
  console.log(pc.gray("  ─────────────────────────────────────────────────"));
  if (findings.length === 0) {
    console.log(pc.green("  ✓ No findings detected."));
  } else {
    for (const [sev, count] of Object.entries(counts).sort(
      ([a], [b]) => (SEVERITY_ORDER[b] ?? 0) - (SEVERITY_ORDER[a] ?? 0)
    )) {
      console.log(`  ${severityColor(sev)}  ${count} finding${count === 1 ? "" : "s"}`);
    }
  }

  console.log();
  console.log(pc.bold("  Top findings"));
  console.log(pc.gray("  ─────────────────────────────────────────────────"));
  const topFindings = findings.slice(0, 10);
  if (topFindings.length === 0) {
    console.log(pc.gray("  (none)"));
  } else {
    for (const f of topFindings) {
      console.log(`  ${severityColor(f.severity)}  ${pc.white(f.title)}`);
      console.log(pc.gray(`     ${f.description.slice(0, 100)}${f.description.length > 100 ? "…" : ""}`));
      console.log();
    }
  }

  // 5. Export to file if requested
  if (options.output) {
    const outputPath = resolve(options.output);
    const isJson = outputPath.endsWith(".json");
    const format = isJson ? "json" : "markdown";
    try {
      const res = await fetch(`${apiBase}/api/runs/${runId}/export?format=${format}`, {
        headers: { Accept: isJson ? "application/json" : "text/markdown" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = isJson ? JSON.stringify(await res.json(), null, 2) : await res.text();
      writeFileSync(outputPath, content, "utf-8");
      console.log(pc.green(`  ✓ Report saved to `) + pc.cyan(outputPath));
    } catch (err) {
      console.error(pc.red("  ✗ Export failed: ") + String(err));
    }
  }

  console.log();
  console.log(
    pc.gray("  View full report: ") +
      pc.cyan(`${apiBase.replace(":3001", ":3000")}/runs/${runId}`)
  );
  console.log();

  // Exit with non-zero code if there are critical/high findings
  const blockingCount = (counts["critical"] ?? 0) + (counts["high"] ?? 0);
  if (blockingCount > 0) {
    process.exitCode = 1;
  }
}
