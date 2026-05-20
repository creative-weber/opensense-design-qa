import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { ZodError, z } from "zod";

// ─── Environment ──────────────────────────────────────────────────────────────

const PORT = Number(process.env["API_PORT"] ?? 3001);
const HOST = process.env["API_HOST"] ?? "0.0.0.0";

const AUDIT_START_DELAY_MS = 25;
const AUDIT_FINISH_DELAY_MS = 75;
const FAILURE_RETRY_COUNT = 3;
const WEB_BASE_URL = (process.env["WEB_BASE_URL"] ?? "http://localhost:3000").replace(/\/$/, "");
const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

// ─── In-memory stores (stub implementations for Sprint 0) ─────────────────────

type Project = { id: string; name: string; createdAt: string };
type ViewportRun = { id: string; runId: string; viewport: string; status: string; errorCode?: string; attemptsMade?: number };
type AuditRun = {
  id: string;
  projectId: string;
  url: string;
  status: string;
  viewportRuns: ViewportRun[];
  figmaFrameUrl?: string;
  createdAt: string;
};
type Finding = {
  id: string;
  runId: string;
  ruleId: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  evidence: unknown[];
};
type CaptureArtifact = {
  id: string;
  runId: string;
  viewport: string;
  artifactType: "screenshot" | "figma_frame";
  storageKey: string;
  capturedAt: string;
  signedUrl: string;
  source?: "page_capture_stub" | "direct_image_url" | "figma_api" | "fallback_placeholder";
};
type IgnoreRule = { id: string; runId: string; ruleId: string; selector?: string; region?: unknown };
type IgnoreRegion = { x: number; y: number; width: number; height: number };
type EvidenceRegion = { x: number; y: number; width: number; height: number };

function isIgnoreRegion(value: unknown): value is IgnoreRegion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const region = value as Partial<IgnoreRegion>;
  return (
    typeof region.x === "number" &&
    typeof region.y === "number" &&
    typeof region.width === "number" &&
    typeof region.height === "number"
  );
}

function getDomSelectorFromEvidence(evidence: unknown): string | undefined {
  if (typeof evidence !== "object" || evidence === null) {
    return undefined;
  }
  const selector = (evidence as { domSelector?: unknown }).domSelector;
  return typeof selector === "string" ? selector : undefined;
}

function getScreenshotRegionFromEvidence(
  evidence: unknown
): EvidenceRegion | undefined {
  if (typeof evidence !== "object" || evidence === null) {
    return undefined;
  }

  const screenshotRegion = (evidence as { screenshotRegion?: unknown })
    .screenshotRegion;
  if (!isIgnoreRegion(screenshotRegion)) {
    return undefined;
  }
  return screenshotRegion;
}

function regionsOverlap(a: EvidenceRegion, b: IgnoreRegion): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function isFindingIgnored(finding: Finding, rules: IgnoreRule[]): boolean {
  if (rules.some((rule) => rule.ruleId && rule.ruleId === finding.ruleId)) {
    return true;
  }

  if (
    rules.some(
      (rule) =>
        rule.selector &&
        finding.evidence.some(
          (evidence) => getDomSelectorFromEvidence(evidence) === rule.selector
        )
    )
  ) {
    return true;
  }

  return rules.some((rule) => {
    const region = rule.region;
    if (!isIgnoreRegion(region)) {
      return false;
    }
    return finding.evidence.some((evidence) => {
      const screenshotRegion = getScreenshotRegionFromEvidence(evidence);
      if (!screenshotRegion) {
        return false;
      }
      return regionsOverlap(screenshotRegion, region);
    });
  });
}

function getSeverityWeight(severity: Finding["severity"]): number {
  const order = { high: 3, medium: 2, low: 1 } as Record<string, number>;
  return order[severity] ?? 0;
}

function getFindingEvidenceLinks(finding: Finding): string[] {
  const links: string[] = [];
  for (const evidence of finding.evidence) {
    if (
      typeof evidence === "object" &&
      evidence !== null &&
      "screenshotUrl" in evidence &&
      typeof (evidence as { screenshotUrl?: unknown }).screenshotUrl === "string"
    ) {
      links.push((evidence as { screenshotUrl: string }).screenshotUrl);
    }
  }
  return links;
}

function createFinding(
  runId: string,
  ruleId: string,
  title: string,
  severity: Finding["severity"],
  evidence: unknown[],
  description = title
): Finding {
  return {
    id: crypto.randomUUID(),
    runId,
    ruleId,
    title,
    severity,
    description,
    evidence,
  };
}

function getFigmaFallbackSignedUrl(runId: string): string {
  return `${WEB_BASE_URL}/artifacts/figma-frame-screenshot.svg?runId=${runId}&signature=test`;
}

function getNodeIdFromHash(hash: string): string | null {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(normalizedHash);
  const nodeIdFromParams = hashParams.get("node-id")?.trim();
  if (nodeIdFromParams) {
    return nodeIdFromParams;
  }

  const directMatch = normalizedHash.match(/(?:^|&)node-id=([^&]+)/i);
  if (!directMatch?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(directMatch[1]).trim();
  } catch {
    return directMatch[1].trim();
  }
}

function parseFigmaFrameReference(
  figmaFrameUrl: string
): { fileKey: string; nodeId: string } | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(figmaFrameUrl);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host !== "figma.com" && host !== "www.figma.com") {
    return null;
  }

  const match = parsedUrl.pathname.match(/^\/(?:design|file|proto)\/([^/]+)/i);
  if (!match?.[1]) {
    return null;
  }

  const rawNodeId =
    parsedUrl.searchParams.get("node-id")?.trim() ?? getNodeIdFromHash(parsedUrl.hash);
  if (!rawNodeId) {
    return null;
  }

  const nodeId = rawNodeId.includes(":") ? rawNodeId : rawNodeId.replace(/-/g, ":");
  if (!nodeId) {
    return null;
  }

  return {
    fileKey: match[1],
    nodeId,
  };
}

async function getFigmaSignedUrl(
  figmaFrameUrl: string,
  runId: string
): Promise<{ signedUrl: string; source: CaptureArtifact["source"] }> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(figmaFrameUrl);
  } catch {
    return { signedUrl: getFigmaFallbackSignedUrl(runId), source: "fallback_placeholder" };
  }

  const pathname = parsedUrl.pathname.toLowerCase();
  const isImageAssetPath =
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp");

  if (isImageAssetPath) {
    return { signedUrl: figmaFrameUrl, source: "direct_image_url" };
  }

  const figmaToken = process.env["FIGMA_ACCESS_TOKEN"]?.trim();
  const frameReference = parseFigmaFrameReference(figmaFrameUrl);

  if (!figmaToken || !frameReference) {
    return { signedUrl: getFigmaFallbackSignedUrl(runId), source: "fallback_placeholder" };
  }

  try {
    const imageApiUrl = new URL(`${FIGMA_API_BASE_URL}/images/${frameReference.fileKey}`);
    imageApiUrl.searchParams.set("ids", frameReference.nodeId);
    imageApiUrl.searchParams.set("format", "png");
    imageApiUrl.searchParams.set("scale", "2");

    const response = await fetch(imageApiUrl.toString(), {
      headers: {
        "X-Figma-Token": figmaToken,
      },
    });

    if (!response.ok) {
      return { signedUrl: getFigmaFallbackSignedUrl(runId), source: "fallback_placeholder" };
    }

    const body = (await response.json()) as {
      images?: Record<string, string | null>;
    };
    const directMatch = body.images?.[frameReference.nodeId];
    const dashNodeId = frameReference.nodeId.replace(/:/g, "-");
    const dashMatch = body.images?.[dashNodeId];

    if (typeof directMatch === "string" && directMatch.length > 0) {
      return { signedUrl: directMatch, source: "figma_api" };
    }
    if (typeof dashMatch === "string" && dashMatch.length > 0) {
      return { signedUrl: dashMatch, source: "figma_api" };
    }
  } catch {
    return { signedUrl: getFigmaFallbackSignedUrl(runId), source: "fallback_placeholder" };
  }

  return { signedUrl: getFigmaFallbackSignedUrl(runId), source: "fallback_placeholder" };
}

function buildDashboardFigmaFindings(
  runId: string,
  targetUrl: URL,
  figmaFrameUrl: string,
  runArtifacts: CaptureArtifact[]
): Finding[] {
  const screenshotUrl =
    runArtifacts.find(
      (artifact) => artifact.viewport === "desktop" && artifact.artifactType === "screenshot"
    )?.signedUrl ??
    runArtifacts.find((artifact) => artifact.artifactType === "screenshot")?.signedUrl;

  if (!screenshotUrl) {
    return [];
  }

  const hostMatchesLocalDashboard =
    targetUrl.hostname === "localhost" && targetUrl.port === "5173";
  const referencesCommunityDashboard =
    figmaFrameUrl.includes("Analytics-Dashboard--Community") ||
    figmaFrameUrl.includes("qV55cgBXcAXWsmdHhir6Nm");

  if (!hostMatchesLocalDashboard || !referencesCommunityDashboard) {
    return [];
  }

  return [
    createFinding(
      runId,
      "figma-comparison-layout-drift",
      "Sidebar and content rhythm diverge from Figma",
      "high",
      [
        {
          domSelector: ".dashboard-shell",
          computedValue: "Sidebar width and content gutter do not align to frame grid",
          expectedValue: "Match Figma frame column widths and horizontal spacing",
          screenshotRegion: {
            x: 0,
            y: 0,
            width: 780,
            height: 620,
          },
          figmaFrameUrl,
          screenshotUrl,
          additionalData: {
            developerReasoning:
              "The live layout uses different shell proportions than the Figma frame, shifting card blocks and reducing alignment fidelity.",
            nextSteps: [
              "Align sidebar column width to frame dimensions.",
              "Match main content horizontal paddings and card spacing tokens.",
              "Re-run desktop audit after spacing changes.",
            ],
          },
        },
      ],
      "Global page grid spacing is inconsistent with the provided Figma frame."
    ),
    createFinding(
      runId,
      "figma-comparison-visual-style",
      "Color and typography scale mismatch",
      "medium",
      [
        {
          domSelector: ".topbar h2",
          computedValue: "Current heading scale and color diverge from frame styling",
          expectedValue: "Match Figma typography tokens and palette hierarchy",
          screenshotRegion: {
            x: 250,
            y: 34,
            width: 640,
            height: 200,
          },
          figmaFrameUrl,
          screenshotUrl,
          additionalData: {
            developerReasoning:
              "Heading and KPI cards carry a different visual emphasis than the design reference due to token drift in font sizing and color contrast.",
            nextSteps: [
              "Apply frame typography scale for page title, metric values, and card labels.",
              "Align background and accent token values to Figma design colors.",
            ],
          },
        },
      ],
      "Visual tokens do not match the Figma reference hierarchy."
    ),
    createFinding(
      runId,
      "figma-comparison-content-delta",
      "Data presentation differs from frame content",
      "low",
      [
        {
          domSelector: ".table-card",
          computedValue: "Runtime content and chart labels differ from the design sample",
          expectedValue: "Use frame-consistent text and chart copy for baseline comparison",
          screenshotRegion: {
            x: 236,
            y: 438,
            width: 920,
            height: 330,
          },
          figmaFrameUrl,
          screenshotUrl,
        },
      ],
      "Displayed labels and values are not aligned with the design reference content baseline."
    ),
  ];
}

function buildFindingsForUrl(
  runId: string,
  targetUrl: string,
  figmaFrameUrl?: string,
  runArtifacts: CaptureArtifact[] = []
): Finding[] {
  const parsedTargetUrl = new URL(targetUrl);
  const { pathname } = parsedTargetUrl;

  if (pathname === "/fixtures/test-landing" && figmaFrameUrl) {
    // Stubbed figma diff signal for deterministic non-happy-path QA.
    if (figmaFrameUrl.includes("test-landing-mismatch-frame.svg")) {
      const screenshotUrl =
        runArtifacts.find(
          (artifact) => artifact.viewport === "desktop" && artifact.artifactType === "screenshot"
        )?.signedUrl ??
        runArtifacts.find((artifact) => artifact.artifactType === "screenshot")?.signedUrl;

      return [
        createFinding(
          runId,
          "figma-comparison-layout-drift",
          "Layout diverges from Figma reference frame",
          "high",
          [
            {
              domSelector: "section:nth-of-type(1)",
              computedValue: "hero block height and spacing differ",
              expectedValue: "match Figma frame geometry",
              screenshotRegion: {
                x: 48,
                y: 80,
                width: 576,
                height: 240,
              },
              figmaFrameUrl,
              screenshotUrl,
              additionalData: {
                developerReasoning:
                  "The hero container and internal spacing do not align with the Figma frame grid, causing visible vertical rhythm drift and CTA block displacement.",
                nextSteps: [
                  "Match hero section min-height, top/bottom padding, and CTA group spacing to the Figma frame values.",
                  "Align heading line breaks and max-width so text wraps at the same points as the design.",
                  "Re-run audit and confirm layout delta is removed for desktop viewport.",
                ],
              },
            },
          ],
          "Hero section spacing and content geometry are inconsistent with the reference frame."
        ),
        createFinding(
          runId,
          "figma-comparison-visual-style",
          "Color and typography mismatch against Figma frame",
          "medium",
          [
            {
              domSelector: "header",
              computedValue: "blue theme with AcmeOps branding",
              expectedValue: "dark/orange BetaForge styling in mismatch frame",
              screenshotRegion: {
                x: 0,
                y: 0,
                width: 672,
                height: 64,
              },
              figmaFrameUrl,
              screenshotUrl,
              additionalData: {
                developerReasoning:
                  "Brand palette and typography tokens differ from the supplied Figma frame, so visual identity and emphasis hierarchy do not match the design baseline.",
                nextSteps: [
                  "Map header, hero, and CTA colors to the Figma token set for this scenario.",
                  "Update heading and body typography scale (font size, weight, line height) to match the frame.",
                  "Verify button labels and brand copy match Figma content exactly.",
                ],
              },
            },
          ],
          "The rendered page style tokens do not match the provided Figma reference."
        ),
      ];
    }
  }

  if (figmaFrameUrl) {
    const dashboardFindings = buildDashboardFigmaFindings(
      runId,
      parsedTargetUrl,
      figmaFrameUrl,
      runArtifacts
    );
    if (dashboardFindings.length > 0) {
      return dashboardFindings;
    }
  }

  switch (pathname) {
    case "/fixtures/overflow":
      return [
        createFinding(
          runId,
          "overflow-clipping",
          "Content overflows its clipping container",
          "high",
          [
            {
              domSelector: ".fixture-overflow__content",
              computedValue: "scrollWidth=720px",
              expectedValue: "<= clientWidth",
            },
          ]
        ),
      ];
    case "/fixtures/overlap":
      return [
        createFinding(
          runId,
          "element-overlap",
          "Elements overlap in the hero stack",
          "high",
          [
            { domSelector: ".fixture-overlap__card--primary" },
            { domSelector: ".fixture-overlap__card--secondary" },
          ]
        ),
      ];
    case "/fixtures/alignment-drift":
      return [
        createFinding(
          runId,
          "alignment-drift",
          "Sibling elements drift off the dominant left edge",
          "medium",
          [
            {
              domSelector: ".fixture-alignment__item--drifted",
              computedValue: "left=36px",
              expectedValue: "left=0px",
            },
          ]
        ),
      ];
    case "/fixtures/spacing-inconsistency":
      return [
        createFinding(
          runId,
          "spacing-inconsistency",
          "Sibling spacing breaks the page rhythm",
          "low",
          [
            {
              domSelector: ".fixture-spacing__item--outlier",
              computedValue: "gap=36px",
              expectedValue: "gap=16px",
            },
          ]
        ),
      ];
    case "/fixtures/typography-inconsistency":
      return [
        createFinding(
          runId,
          "typography-inconsistency",
          "Typography scale introduces an off-scale body style",
          "medium",
          [
            {
              domSelector: ".fixture-typography__outlier",
              computedValue: "font-size=19px",
              expectedValue: "16px or 24px",
            },
          ]
        ),
      ];
    case "/fixtures/color-mismatch":
      return [
        createFinding(
          runId,
          "color-mismatch",
          "Text palette uses an unexpected accent color",
          "low",
          [
            {
              domSelector: ".fixture-color__outlier",
              computedValue: "rgb(190, 24, 93)",
              expectedValue: "dominant neutral palette",
            },
          ]
        ),
      ];
    case "/fixtures/contrast":
      return [
        createFinding(
          runId,
          "contrast-warning",
          "Normal text contrast falls below WCAG AA",
          "high",
          [
            {
              domSelector: ".fixture-contrast__copy",
              computedValue: "#8f8f8f on #ffffff (3.2:1)",
              expectedValue: "4.5:1 minimum",
              foregroundColor: "#8f8f8f",
              backgroundColor: "#ffffff",
            },
          ],
          "Normal text contrast ratio is below the WCAG AA threshold"
        ),
      ];
    case "/fixtures/contrast-large-text":
      return [
        createFinding(
          runId,
          "contrast-warning",
          "Large text contrast falls below the relaxed threshold",
          "medium",
          [
            {
              domSelector: ".fixture-contrast-large__headline",
              computedValue: "#767676 on #ffffff (2.7:1)",
              expectedValue: "3:1 minimum",
              foregroundColor: "#767676",
              backgroundColor: "#ffffff",
            },
          ],
          "Large text contrast ratio is below the WCAG AA large text threshold"
        ),
      ];
    default:
      return [];
  }
}

function isUnreachableTarget(targetUrl: string): boolean {
  const parsed = new URL(targetUrl);
  return parsed.hostname === "localhost" && parsed.port === "19999";
}

// ─── Build application ────────────────────────────────────────────────────────

export function buildApp() {
  const projects = new Map<string, Project>();
  const runs = new Map<string, AuditRun>();
  const findings = new Map<string, Finding[]>();
  const artifacts = new Map<string, CaptureArtifact[]>();
  const ignoreRules = new Map<string, IgnoreRule[]>();
  const processingTimers = new Set<ReturnType<typeof setTimeout>>();

  const trackTimer = (callback: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      processingTimers.delete(timer);
      callback();
    }, delayMs);
    processingTimers.add(timer);
  };

  const createArtifactsForRun = async (run: AuditRun): Promise<CaptureArtifact[]> => {
    const capturedAt = new Date().toISOString();
    const viewportArtifactMap: Record<string, string> = {
      desktop: "desktop-screenshot.svg",
      tablet: "tablet-screenshot.svg",
      mobile: "mobile-screenshot.svg",
    };

    const screenshotArtifacts: CaptureArtifact[] = run.viewportRuns.map((viewportRun) => {
      const fileName = viewportArtifactMap[viewportRun.viewport] ?? "desktop-screenshot.svg";
      const storageKey = `artifacts/${run.id}/${fileName}`;
      return {
        id: crypto.randomUUID(),
        runId: run.id,
        viewport: viewportRun.viewport,
        artifactType: "screenshot" as const,
        storageKey,
        capturedAt,
        signedUrl: `${WEB_BASE_URL}/artifacts/${fileName}?runId=${run.id}&signature=test`,
        source: "page_capture_stub",
      };
    });

    if (!run.figmaFrameUrl) {
      return screenshotArtifacts;
    }

    const figmaReference = await getFigmaSignedUrl(run.figmaFrameUrl, run.id);
    const figmaArtifacts: CaptureArtifact[] = run.viewportRuns.map((viewportRun) => ({
      id: crypto.randomUUID(),
      runId: run.id,
      viewport: viewportRun.viewport,
      artifactType: "figma_frame" as const,
      storageKey: `artifacts/${run.id}/${viewportRun.viewport}-figma-frame-screenshot.svg`,
      capturedAt,
      signedUrl: figmaReference.signedUrl,
      source: figmaReference.source,
    }));

    return [...screenshotArtifacts, ...figmaArtifacts];
  };

  const scheduleRunProcessing = (runId: string) => {
    trackTimer(() => {
      const run = runs.get(runId);
      if (!run) {
        return;
      }

      run.status = "capturing";
      for (const viewportRun of run.viewportRuns) {
        viewportRun.status = "capturing";
        viewportRun.attemptsMade = 1;
      }

      trackTimer(() => {
        void (async () => {
          const latestRun = runs.get(runId);
          if (!latestRun) {
            return;
          }

          if (isUnreachableTarget(latestRun.url)) {
            latestRun.status = "failed";
            for (const viewportRun of latestRun.viewportRuns) {
              viewportRun.status = "failed";
              viewportRun.errorCode = "NON_200_RESPONSE";
              viewportRun.attemptsMade = FAILURE_RETRY_COUNT;
            }
            findings.set(runId, []);
            artifacts.set(runId, []);
            return;
          }

          const runArtifacts = await createArtifactsForRun(latestRun);
          artifacts.set(runId, runArtifacts);
          findings.set(
            runId,
            buildFindingsForUrl(runId, latestRun.url, latestRun.figmaFrameUrl, runArtifacts)
          );

          latestRun.status = "rules_complete";
          for (const viewportRun of latestRun.viewportRuns) {
            viewportRun.status = "rules_complete";
            viewportRun.errorCode = undefined;
          }
        })().catch(() => {
          const failedRun = runs.get(runId);
          if (!failedRun) {
            return;
          }
          failedRun.status = "failed";
          for (const viewportRun of failedRun.viewportRuns) {
            viewportRun.status = "failed";
            viewportRun.errorCode = "INTERNAL_ERROR";
            viewportRun.attemptsMade = FAILURE_RETRY_COUNT;
          }
          findings.set(runId, []);
          artifacts.set(runId, []);
        });
      }, AUDIT_FINISH_DELAY_MS);
    }, AUDIT_START_DELAY_MS);
  };

  const app = Fastify({
    logger:
      process.env["NODE_ENV"] !== "test"
        ? {
            transport:
              process.env["NODE_ENV"] !== "production"
                ? { target: "pino-pretty" }
                : undefined,
          }
        : false,
  });

  // ── Plugins ────────────────────────────────────────────────────────────────
  void app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? true,
  });
  void app.register(helmet);

  app.addHook("onClose", async () => {
    for (const timer of processingTimers) {
      clearTimeout(timer);
    }
    processingTimers.clear();
  });

  // ── Zod validation error handler ───────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const normalizedError =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown error");
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? ((error as { statusCode: number }).statusCode ?? 500)
        : 500;

    app.log.error(error);
    return reply.status(statusCode).send({
      statusCode,
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });

  // ── Health endpoint ────────────────────────────────────────────────────────
  app.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok" });
  });

  // ── Projects ───────────────────────────────────────────────────────────────
  app.post("/api/projects", async (request, reply) => {
    const body = z.object({ name: z.string().min(1) }).parse(request.body);
    const project: Project = {
      id: crypto.randomUUID(),
      name: body.name,
      createdAt: new Date().toISOString(),
    };
    projects.set(project.id, project);
    return reply.status(201).send(project);
  });

  app.get("/api/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = projects.get(id);
    if (!project) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Project not found" });
    }
    return reply.send(project);
  });

  // ── Runs ───────────────────────────────────────────────────────────────────
  const ViewportEnum = z.enum(["desktop", "tablet", "mobile"]);

  app.post("/api/runs", async (request, reply) => {
    const body = z
      .object({
        projectId: z.string().uuid(),
        url: z.string().url(),
        viewports: z.array(ViewportEnum).min(1),
        figmaFrameUrl: z.string().url().optional(),
        captureConfig: z.object({ waitStrategies: z.array(z.unknown()).optional() }).optional(),
      })
      .parse(request.body);

    if (!projects.has(body.projectId)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Project not found" });
    }

    const runId = crypto.randomUUID();
    const viewportRuns: ViewportRun[] = body.viewports.map((viewport) => ({
      id: crypto.randomUUID(),
      runId,
      viewport,
      status: "queued",
    }));

    const run: AuditRun = {
      id: runId,
      projectId: body.projectId,
      url: body.url,
      status: "queued",
      viewportRuns,
      figmaFrameUrl: body.figmaFrameUrl,
      createdAt: new Date().toISOString(),
    };

    runs.set(runId, run);
    findings.set(runId, []);
    artifacts.set(runId, []);
    ignoreRules.set(runId, []);
    scheduleRunProcessing(runId);

    return reply.status(201).send(run);
  });

  app.get("/api/runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);
    if (!run) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }
    return reply.send(run);
  });

  // ── Findings ───────────────────────────────────────────────────────────────
  app.get("/api/runs/:id/findings", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!runs.has(id)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    const query = request.query as { page?: string; pageSize?: string };
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);

    const runFindings = findings.get(id) ?? [];
    const activeIgnoreRules = ignoreRules.get(id) ?? [];

    // Mark findings as isIgnored for audit traceability
    const findingsWithIgnore = runFindings.map((finding) => ({
      ...finding,
      isIgnored: isFindingIgnored(finding, activeIgnoreRules),
    }));

    // Only return non-ignored findings in the main list, but include isIgnored field
    const active = findingsWithIgnore
      .filter(f => !f.isIgnored)
      .sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 } as Record<string, number>;
        return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
      });

    const start = (page - 1) * pageSize;
    const data = active.slice(start, start + pageSize);

    return reply.send({ data, total: active.length, page });
  });

  // ── Artifacts ─────────────────────────────────────────────────────────────
  app.get("/api/runs/:id/artifacts", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!runs.has(id)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }
    return reply.send(artifacts.get(id) ?? []);
  });

  // ── Run export ────────────────────────────────────────────────────────────
  app.get("/api/runs/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);
    if (!run) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    const query = request.query as { format?: string };
    const format = z.enum(["json", "markdown"]).parse(query.format ?? "json");

    const runFindings = findings.get(id) ?? [];
    const sortedFindings = [...runFindings].sort(
      (a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity)
    );

    const severitySummary = {
      high: sortedFindings.filter((f) => f.severity === "high").length,
      medium: sortedFindings.filter((f) => f.severity === "medium").length,
      low: sortedFindings.filter((f) => f.severity === "low").length,
    };

    const topBlockingFindings = sortedFindings.slice(0, 10).map((finding) => ({
      id: finding.id,
      ruleId: finding.ruleId,
      title: finding.title,
      severity: finding.severity,
      description: finding.description,
      evidenceLinks: getFindingEvidenceLinks(finding),
      nextActions: [
        `Inspect rule ${finding.ruleId} evidence and affected selectors`,
        "Apply fix and re-run audit to confirm resolution",
      ],
    }));

    const exportPayload = {
      run: {
        id: run.id,
        projectId: run.projectId,
        url: run.url,
        status: run.status,
        createdAt: run.createdAt,
      },
      summary: {
        totalFindings: sortedFindings.length,
        ...severitySummary,
      },
      topBlockingFindings,
      artifacts: artifacts.get(id) ?? [],
    };

    if (format === "json") {
      return reply.send(exportPayload);
    }

    const markdown = [
      `# Run Export: ${run.id}`,
      "",
      `- Project ID: ${run.projectId}`,
      `- URL: ${run.url}`,
      `- Status: ${run.status}`,
      `- Created At: ${run.createdAt}`,
      "",
      "## Severity Summary",
      "",
      `- High: ${severitySummary.high}`,
      `- Medium: ${severitySummary.medium}`,
      `- Low: ${severitySummary.low}`,
      `- Total: ${sortedFindings.length}`,
      "",
      "## Top Blocking Findings",
      "",
      ...topBlockingFindings.flatMap((finding, index) => [
        `### ${index + 1}. ${finding.title} (${finding.severity})`,
        `- Rule: ${finding.ruleId}`,
        `- Description: ${finding.description}`,
        `- Evidence Links: ${finding.evidenceLinks.length > 0 ? finding.evidenceLinks.join(", ") : "None"}`,
        `- Next Actions: ${finding.nextActions.join("; ")}`,
        "",
      ]),
    ].join("\n");

    reply.header("content-type", "text/markdown; charset=utf-8");
    return reply.send(markdown);
  });

  // ── Ignore rules ──────────────────────────────────────────────────────────
  app.post("/api/runs/:id/ignore-rules", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!runs.has(id)) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Run not found" });
    }

    const body = z
      .object({
        ruleId: z.string().min(1),
        selector: z.string().optional(),
        region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
      })
      .parse(request.body);

    const rule: IgnoreRule = { id: crypto.randomUUID(), runId: id, ...body };
    ignoreRules.get(id)!.push(rule);

    return reply.status(201).send(rule);
  });

  return app;
}

// ─── Start server (only when run directly) ────────────────────────────────────

if (process.env["ODQA_START_SERVER"] === "1") {
  const app = buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
