/**
 * Database seed script — ODQA-050
 * Run with: pnpm db:seed
 *
 * Inserts a sample project, one complete audit run, and findings
 * across two viewports for local UI development. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.info("Seeding database…");

  // ── Project ────────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Example Project",
    },
  });

  console.info(`Project: ${project.name} (${project.id})`);

  // ── AuditRun ───────────────────────────────────────────────────────────────
  const run = await prisma.auditRun.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      projectId: project.id,
      url: "https://example.com",
      status: "complete",
      completedAt: new Date(),
    },
  });

  console.info(`AuditRun: ${run.id} (${run.status})`);

  // ── ViewportRuns ───────────────────────────────────────────────────────────
  const desktopRun = await prisma.viewportRun.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      auditRunId: run.id,
      viewport: "desktop",
      viewportWidth: 1440,
      viewportHeight: 900,
      status: "complete",
      completedAt: new Date(),
    },
  });

  const mobileRun = await prisma.viewportRun.upsert({
    where: { id: "00000000-0000-0000-0000-000000000004" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000004",
      auditRunId: run.id,
      viewport: "mobile",
      viewportWidth: 390,
      viewportHeight: 844,
      status: "complete",
      completedAt: new Date(),
    },
  });

  // ── Findings ───────────────────────────────────────────────────────────────
  const findings = [
    // Desktop findings
    { vpRunId: desktopRun.id, ruleId: "web/overflow", findingType: "overflow", title: "Horizontal overflow detected", description: "Element scrollWidth exceeds clientWidth by 34px", severity: "high" as const },
    { vpRunId: desktopRun.id, ruleId: "web/contrast", findingType: "contrast-warning", title: "Low contrast ratio", description: "Text contrast ratio is 3.1, below WCAG AA threshold of 4.5", severity: "high" as const },
    { vpRunId: desktopRun.id, ruleId: "web/alignment", findingType: "alignment-drift", title: "Alignment drift in nav items", description: "Left-edge drift of 6px detected across 4 sibling elements", severity: "medium" as const },
    { vpRunId: desktopRun.id, ruleId: "web/spacing", findingType: "spacing-inconsistency", title: "Spacing outlier between cards", description: "Gap of 48px breaks the 24px rhythm (deviation: 24px)", severity: "low" as const },
    { vpRunId: desktopRun.id, ruleId: "web/typography", findingType: "typography-inconsistency", title: "Uncommon font size", description: "Font size 13px appears only once; dominant scale is 14px, 16px, 24px", severity: "medium" as const },
    // Mobile findings
    { vpRunId: mobileRun.id, ruleId: "web/overflow", findingType: "overflow", title: "Horizontal overflow on mobile", description: "Hero section overflows viewport by 20px on 390px width", severity: "high" as const },
    { vpRunId: mobileRun.id, ruleId: "web/overlap", findingType: "overlap", title: "Button overlaps footer text", description: "CTA button bounding box intersects footer paragraph by 220px²", severity: "high" as const },
    { vpRunId: mobileRun.id, ruleId: "web/contrast", findingType: "contrast-warning", title: "Low contrast on mobile nav", description: "Nav link contrast ratio is 2.8 on dark background", severity: "high" as const },
    { vpRunId: mobileRun.id, ruleId: "web/spacing", findingType: "spacing-inconsistency", title: "Inconsistent list spacing", description: "Gap of 4px breaks the 12px rhythm in feature list", severity: "low" as const },
    { vpRunId: mobileRun.id, ruleId: "web/color", findingType: "color-mismatch", title: "Rare background color", description: "Background #f5e6c8 appears on 1 element (0.4% of elements)", severity: "low" as const },
  ];

  for (const f of findings) {
    await prisma.finding.upsert({
      where: { id: `seed-finding-${f.ruleId}-${f.vpRunId}` },
      update: {},
      create: {
        id: `seed-finding-${f.ruleId}-${f.vpRunId}`,
        viewportRunId: f.vpRunId,
        ruleId: f.ruleId,
        findingType: f.findingType,
        title: f.title,
        description: f.description,
        severity: f.severity,
      },
    });
  }

  console.info(`Seeded ${findings.length} findings`);
  console.info("Seed complete ✓");
}

await main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
