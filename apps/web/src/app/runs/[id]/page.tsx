"use client";

import Link from "next/link";
import { use, useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildViewportComparisons } from "./artifactComparisons";
import { ComparisonViewer, type DiffFinding } from "../../../components/ComparisonViewer";

const TERMINAL_RUN_STATUSES = new Set(["rules_complete", "complete", "failed"]);

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type RunStatusPageProps = {
  params: Promise<{ id: string }>;
};

type RunResponse = {
  id: string;
  url: string;
  status: string;
  figmaFrameUrl?: string;
  createdAt: string;
  viewportRuns: Array<{
    id: string;
    viewport: string;
    status: string;
    errorCode?: string;
    attemptsMade?: number;
  }>;
};

type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

type FindingItem = {
  id: string;
  viewportRunId: string;
  ruleId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  evidence: Array<{
    domSelector?: string;
    computedValue?: string;
    expectedValue?: string;
    screenshotRegion?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    additionalData?: {
      developerReasoning?: string;
      nextSteps?: string[];
    };
  }>;
};

type FindingsSummaryResponse = {
  data: FindingItem[];
  total: number;
  page: number;
};

type ArtifactResponse = {
  id: string;
  artifactType: "screenshot" | "diff_image" | "figma_frame";
  viewport: string;
  storageKey: string;
  signedUrl?: string;
  source?: "page_capture_stub" | "page_capture_live" | "direct_image_url" | "figma_api" | "fallback_placeholder";
};

function formatArtifactSource(source?: ArtifactResponse["source"]) {
  if (!source) {
    return "Unknown";
  }

  const map: Record<NonNullable<ArtifactResponse["source"]>, string> = {
    page_capture_stub: "Page Capture Stub",
    page_capture_live: "Live Page Capture",
    direct_image_url: "Direct Image URL",
    figma_api: "Figma API",
    fallback_placeholder: "Fallback Placeholder",
  };

  return map[source];
}

function ImageEnlargementModal({
  imageUrl,
  altText,
  onClose,
}: {
  imageUrl: string;
  altText: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Image enlargement"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 transition-colors"
          aria-label="Close image"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img src={imageUrl} alt={altText} className="w-full h-auto max-h-[85vh] object-contain" />
      </div>
    </div>
  );
}

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low", "info"];

function ExportDropdown({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = (format: "json" | "markdown") => {
    const url = `${apiBase}/api/runs/${runId}/export?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${runId}.${format === "json" ? "json" : "md"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleDownload("json")}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download JSON
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleDownload("markdown")}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download Markdown
          </button>
        </div>
      )}
    </div>
  );
}

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const SEVERITY_COLORS: Record<FindingSeverity, { badge: string; header: string; border: string }> = {
  critical: {
    badge: "bg-red-200 text-red-900",
    header: "bg-red-50 border-red-200 text-red-900",
    border: "border-red-200",
  },
  high: {
    badge: "bg-red-100 text-red-800",
    header: "bg-red-50 border-red-200 text-red-800",
    border: "border-red-200",
  },
  medium: {
    badge: "bg-amber-100 text-amber-800",
    header: "bg-amber-50 border-amber-200 text-amber-800",
    border: "border-amber-200",
  },
  low: {
    badge: "bg-emerald-100 text-emerald-800",
    header: "bg-emerald-50 border-emerald-200 text-emerald-800",
    border: "border-emerald-200",
  },
  info: {
    badge: "bg-slate-100 text-slate-700",
    header: "bg-slate-50 border-slate-200 text-slate-700",
    border: "border-slate-200",
  },
};

function FindingScreenshotThumbnail({
  screenshotUrl,
  region,
  label,
  onEnlarge,
}: {
  screenshotUrl: string;
  region: { x: number; y: number; width: number; height: number };
  label: string;
  onEnlarge: (url: string) => void;
}) {
  const thumbW = 200;
  const scale = thumbW / Math.max(region.width, 1);
  const thumbH = Math.round(region.height * scale);

  return (
    <button
      type="button"
      aria-label={`Enlarge screenshot: ${label}`}
      onClick={() => onEnlarge(screenshotUrl)}
      className="group relative rounded border border-slate-200 bg-slate-100 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-indigo-400 transition-shadow"
      style={{ width: thumbW, height: thumbH }}
    >
      <img
        src={screenshotUrl}
        alt={label}
        style={{
          position: "absolute",
          transformOrigin: "top left",
          transform: `scale(${scale}) translate(${-region.x}px, ${-region.y}px)`,
          maxWidth: "none",
        }}
      />
      <span className="absolute inset-0 flex items-end justify-center p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">View full</span>
      </span>
    </button>
  );
}

export default function RunStatusPage({ params }: RunStatusPageProps) {
  const { id: runId } = use(params);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [selectedViewport, setSelectedViewport] = useState<string>("all");

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["run", runId],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/api/runs/${runId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Failed to load run status");
      }

      return (await response.json()) as RunResponse;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_RUN_STATUSES.has(status) ? false : 1000;
    },
  });

  const { data: findingsSummary, error: findingsError, isLoading: findingsLoading } = useQuery({
    queryKey: ["findings-summary", runId, selectedViewport],
    queryFn: async () => {
      const vpParam = selectedViewport !== "all" ? `&viewport=${selectedViewport}` : "";
      const response = await fetch(
        `${getApiBaseUrl()}/api/runs/${runId}/findings?page=1&pageSize=500${vpParam}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Failed to load run findings");
      }

      return (await response.json()) as FindingsSummaryResponse;
    },
    refetchInterval: (query) => {
      const status = data?.status ?? query.state.data;
      return typeof status === "string" && TERMINAL_RUN_STATUSES.has(status) ? false : 1000;
    },
  });

  const { data: artifacts = [], error: artifactsError, isLoading: artifactsLoading } = useQuery({
    queryKey: ["artifacts", runId],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/api/runs/${runId}/artifacts`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return [];
      }

      return (await response.json()) as ArtifactResponse[];
    },
    refetchInterval: () => {
      const status = data?.status;
      return status && TERMINAL_RUN_STATUSES.has(status) ? false : 1000;
    },
    enabled: !!data?.status, // Only fetch after run data is loaded
  });

  const findingsCount = findingsSummary?.total ?? 0;
  const hasFindings = findingsCount > 0;

  // Build a map from viewportRunId → viewport label for tab rendering
  const viewportRunMap = useMemo<Record<string, string>>(() => {
    if (!data) return {};
    return Object.fromEntries(data.viewportRuns.map((vr) => [vr.id, vr.viewport]));
  }, [data]);

  // Group findings by severity
  const groupedFindings = useMemo(() => {
    const items = findingsSummary?.data ?? [];
    const groups: Record<FindingSeverity, FindingItem[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };
    for (const f of items) {
      const sev = (f.severity in groups ? f.severity : "info") as FindingSeverity;
      groups[sev].push(f);
    }
    return groups;
  }, [findingsSummary]);

  const viewportComparisons = data
    ? buildViewportComparisons(data.viewportRuns, artifacts).filter(
        (comparison) => comparison.screenshot || comparison.figmaFrame
      )
    : [];

  // Build a map from viewport → figma-diff findings for the ComparisonViewer
  const findingsByViewport = useMemo<Record<string, DiffFinding[]>>(() => {
    const items = findingsSummary?.data ?? [];
    const result: Record<string, DiffFinding[]> = {};
    for (const finding of items) {
      if (!finding.ruleId.startsWith("figma-diff/")) continue;
      const viewport = viewportRunMap[finding.viewportRunId];
      if (!viewport) continue;
      if (!result[viewport]) result[viewport] = [];
      result[viewport].push({
        id: finding.id,
        ruleId: finding.ruleId,
        evidence: finding.evidence.map((e) => ({ screenshotRegion: e.screenshotRegion })),
      });
    }
    return result;
  }, [findingsSummary, viewportRunMap]);

  const getEvidenceDetails = (evidence: FindingItem["evidence"]) => {
    const primary = evidence[0];
    return {
      domSelector: primary?.domSelector,
      computedValue: primary?.computedValue,
      expectedValue: primary?.expectedValue,
      screenshotRegion: primary?.screenshotRegion,
      developerReasoning: primary?.additionalData?.developerReasoning,
      nextSteps: primary?.additionalData?.nextSteps ?? [],
    };
  };

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/runs/new" className="text-sm text-indigo-600 hover:underline">
          ← Back to new audit
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Status</h1>
          {data?.status && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {formatStatus(data.status)}
            </span>
          )}
          {hasFindings && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Issues Found: {findingsCount}
            </span>
          )}
        </div>
        <p className="text-slate-600">
          Monitor the current audit run and check each viewport as processing completes.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm text-slate-600">Loading run details...</p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{(error as Error).message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Run details</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Run ID</dt>
                  <dd className="mt-1 break-all text-sm text-slate-900">{data.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Created</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {new Date(data.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Findings</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{findingsCount}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">Target URL</dt>
                  <dd className="mt-1 break-all text-sm text-slate-900">{data.url}</dd>
                </div>
                {data.figmaFrameUrl && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-slate-500">Figma frame</dt>
                    <dd className="mt-1 break-all text-sm text-slate-900">{data.figmaFrameUrl}</dd>
                  </div>
                )}
              </dl>
            </section>

            <aside className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Viewport progress</h2>
              <ul className="mt-4 space-y-3">
                {data.viewportRuns.map((viewportRun) => (
                  <li
                    key={viewportRun.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium capitalize text-slate-900">
                        {viewportRun.viewport}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {formatStatus(viewportRun.status)}
                      </span>
                    </div>
                    {viewportRun.errorCode && (
                      <p className="mt-2 text-xs text-red-600">Error: {viewportRun.errorCode}</p>
                    )}
                    {typeof viewportRun.attemptsMade === "number" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Attempts: {viewportRun.attemptsMade}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Screenshot comparison</h2>

            {(artifactsLoading || isLoading) && (
              <p className="mt-3 text-sm text-slate-600">Loading screenshot artifacts...</p>
            )}

            {artifactsError && (
              <p className="mt-3 text-sm text-red-700">{(artifactsError as Error).message}</p>
            )}

            {!artifactsLoading && !artifactsError && viewportComparisons.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                No screenshot artifacts available yet. Run processing may still be in progress.
              </p>
            )}

            {!artifactsLoading && !artifactsError && viewportComparisons.length > 0 && (
              <div className="mt-4">
                <Suspense fallback={<p className="text-sm text-slate-600">Loading comparison controls...</p>}>
                  <ComparisonViewer
                    comparisons={viewportComparisons}
                    findingsByViewport={findingsByViewport}
                  />
                </Suspense>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Detected issues</h2>
              <div className="flex items-center gap-3">
                {hasFindings && (
                  <span className="text-sm text-slate-500">{findingsCount} total</span>
                )}
                {data.status && TERMINAL_RUN_STATUSES.has(data.status) && (
                  <ExportDropdown runId={runId} />
                )}
              </div>
            </div>

            {/* Viewport tabs */}
            {data && data.viewportRuns.length > 1 && (
              <div className="mt-4 flex gap-1 border-b border-slate-200">
                {(["all", ...data.viewportRuns.map((vr) => vr.viewport)] as string[]).map((vp) => (
                  <button
                    key={vp}
                    type="button"
                    onClick={() => setSelectedViewport(vp)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                      selectedViewport === vp
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {vp === "all" ? "All viewports" : vp}
                  </button>
                ))}
              </div>
            )}

            {findingsLoading && (
              <p className="mt-3 text-sm text-slate-600">Loading findings...</p>
            )}

            {findingsError && (
              <p className="mt-3 text-sm text-red-700">{(findingsError as Error).message}</p>
            )}

            {!findingsLoading && !findingsError && findingsCount === 0 && (
              <p className="mt-3 text-sm text-slate-600">No issues were detected for this run.</p>
            )}

            {!findingsLoading && !findingsError && findingsSummary && findingsCount > 0 && (
              <div className="mt-4 space-y-3">
                {SEVERITY_ORDER.map((sev) => {
                  const items = groupedFindings[sev];
                  if (items.length === 0) return null;
                  const colors = SEVERITY_COLORS[sev];
                  return (
                    <details key={sev} className={`rounded-lg border ${colors.border} overflow-hidden`} open>
                      <summary
                        className={`flex cursor-pointer select-none items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide ${colors.header} list-none`}
                      >
                        <span>{SEVERITY_LABEL[sev]}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${colors.badge}`}>
                          {items.length}
                        </span>
                      </summary>

                      <ul className="divide-y divide-slate-100 bg-white">
                        {items.map((finding) => {
                          const details = getEvidenceDetails(finding.evidence);
                          // Find screenshot URL for this finding's viewport
                          const findingViewport = viewportRunMap[finding.viewportRunId];
                          const vpComparison = viewportComparisons.find(
                            (c) => c.viewport === findingViewport
                          );
                          const screenshotUrl = vpComparison?.screenshot;

                          return (
                            <li key={finding.id} className="p-4">
                              <div className="flex flex-wrap items-start gap-3">
                                {/* Screenshot thumbnail */}
                                {screenshotUrl && details.screenshotRegion && (
                                  <FindingScreenshotThumbnail
                                    screenshotUrl={screenshotUrl}
                                    region={details.screenshotRegion}
                                    label={`${finding.title} screenshot region`}
                                    onEnlarge={setEnlargedImage}
                                  />
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{finding.title}</span>
                                    {findingViewport && selectedViewport === "all" && (
                                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">
                                        {findingViewport}
                                      </span>
                                    )}
                                    <span className="text-xs text-slate-400">Rule: {finding.ruleId}</span>
                                  </div>

                                  <p className="mt-1 text-sm text-slate-700">{finding.description}</p>

                                  {(details.domSelector || details.computedValue || details.expectedValue) && (
                                    <div className="mt-2 grid gap-1 text-xs text-slate-600">
                                      {details.domSelector && (
                                        <p><span className="font-semibold text-slate-700">Selector:</span> {details.domSelector}</p>
                                      )}
                                      {details.computedValue && (
                                        <p><span className="font-semibold text-slate-700">Observed:</span> {details.computedValue}</p>
                                      )}
                                      {details.expectedValue && (
                                        <p><span className="font-semibold text-slate-700">Expected:</span> {details.expectedValue}</p>
                                      )}
                                    </div>
                                  )}

                                  {details.developerReasoning && (
                                    <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Developer reasoning</p>
                                      <p className="mt-0.5 text-xs text-slate-700">{details.developerReasoning}</p>
                                    </div>
                                  )}

                                  {details.nextSteps.length > 0 && (
                                    <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next steps</p>
                                      <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-blue-900">
                                        {details.nextSteps.map((step) => (
                                          <li key={step}>{step}</li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          {enlargedImage && (
            <ImageEnlargementModal
              imageUrl={enlargedImage}
              altText="Enlarged image"
              onClose={() => setEnlargedImage(null)}
            />
          )}
        </>
      )}
    </div>
  );
}