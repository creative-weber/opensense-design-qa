#!/usr/bin/env node
/**
 * OpenDesign QA CLI — Entry Point
 *
 * Usage:
 *   opendesign-qa run <url> [options]
 *   odqa run <url> [options]
 *
 * Examples:
 *   odqa run https://example.com
 *   odqa run https://example.com --viewport desktop,mobile --output report.json
 *   odqa run https://example.com --figma https://www.figma.com/design/abc123/frame-id
 */

import { Command } from "commander";
import { runCommand } from "./commands/run.js";

const program = new Command();

program
  .name("opendesign-qa")
  .alias("odqa")
  .description("OpenDesign QA — audit your web UI against design specs and accessibility standards")
  .version("0.1.0");

program
  .command("run <url>")
  .description("Submit a URL for a design quality audit and stream results to the terminal")
  .option(
    "-v, --viewport <viewports>",
    "Comma-separated list of viewports to test: desktop, tablet, mobile",
    "desktop"
  )
  .option("-f, --figma <figmaUrl>", "Figma frame URL for design comparison")
  .option("-o, --output <file>", "Save the full report to a file (JSON when .json, Markdown otherwise)")
  .option("--api <url>", "OpenDesign QA API base URL", "http://localhost:3001")
  .option("--project <id>", "Project UUID to associate this run with (creates a temp project if omitted)")
  .option("--no-color", "Disable terminal colour output")
  .action(async (url: string, options: RunOptions) => {
    await runCommand(url, options);
  });

program.parse();

// ── Exported types for commands ───────────────────────────────────────────────
export interface RunOptions {
  viewport: string;
  figma?: string;
  output?: string;
  api: string;
  project?: string;
  color: boolean;
}
