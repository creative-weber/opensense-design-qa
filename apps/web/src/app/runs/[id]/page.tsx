"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildViewportComparisons } from "./artifactComparisons";

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

type FindingsSummaryResponse = {
  data: Array<{
    id: string;
    ruleId: string;
    title: string;
    description: string;
    severity: "high" | "medium" | "low";
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
  }>;
  total: number;
  page: number;
};

type ArtifactResponse = {
  id: string;
  artifactType: "screenshot" | "diff_image" | "figma_frame";
  viewport: string;
  storageKey: string;
  signedUrl?: string;
  source?: "page_capture_stub" | "direct_image_url" | "figma_api" | "fallback_placeholder";
};

function formatArtifactSource(source?: ArtifactResponse["source"]) {
  if (!source) {
    return "Unknown";
  }

  const map: Record<NonNullable<ArtifactResponse["source"]>, string> = {
    page_capture_stub: "Page Capture Stub",
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

export default function RunStatusPage({ params }: RunStatusPageProps) {
  const { id: runId } = use(params);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

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
    queryKey: ["findings-summary", runId],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/api/runs/${runId}/findings?page=1&pageSize=20`, {
        cache: "no-store",
      });

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

  const getSeverityBadgeClass = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      case "low":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const viewportComparisons = data
    ? buildViewportComparisons(data.viewportRuns, artifacts).filter(
        (comparison) => comparison.screenshot || comparison.figmaFrame
      )
    : [];

  const getEvidenceDetails = (evidence: FindingsSummaryResponse["data"][number]["evidence"]) => {
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
              <div className="mt-4 space-y-4">
                {viewportComparisons.map((comparison) => (
                  <article
                    key={comparison.viewport}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {comparison.viewport} viewport
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Current page
                        </p>
                        {comparison.screenshot ? (
                          <img
                            src={comparison.screenshot}
                            alt={`${comparison.viewport} page screenshot`}
                            className="w-full h-auto rounded"
                          />
                        ) : (
                          <p className="text-xs text-slate-500">No page screenshot available.</p>
                        )}
                      </div>

                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Figma reference
                        </p>
                        {comparison.figmaFrame ? (
                          <>
                            <img
                              src={comparison.figmaFrame}
                              alt={`${comparison.viewport} figma screenshot`}
                              className="w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setEnlargedImage(comparison.figmaFrame)}
                            />
                            <p className="mt-2 text-xs text-slate-500">
                              Source: {formatArtifactSource(comparison.figmaSource)}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">No Figma screenshot available.</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Detected issues</h2>

            {findingsLoading && (
              <p className="mt-3 text-sm text-slate-600">Loading findings...</p>
            )}

            {findingsError && (
              <p className="mt-3 text-sm text-red-700">{(findingsError as Error).message}</p>
            )}

            {!findingsLoading && !findingsError && findingsCount === 0 && (
              <p className="mt-3 text-sm text-slate-600">No issues were detected for this run.</p>
            )}

            {!findingsLoading && !findingsError && findingsSummary && findingsSummary.data.length > 0 && (
              <ul className="mt-4 space-y-3">
                {findingsSummary.data.map((finding) => (
                  <li key={finding.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    {(() => {
                      const details = getEvidenceDetails(finding.evidence);

                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{finding.title}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${getSeverityBadgeClass(
                                finding.severity
                              )}`}
                            >
                              {finding.severity}
                            </span>
                            <span className="text-xs font-medium text-slate-500">Rule: {finding.ruleId}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{finding.description}</p>

                          {(() => {
                            const desktopComparison = viewportComparisons.find(
                              (comparison) => comparison.viewport === "desktop"
                            );
                            const screenshot = desktopComparison?.screenshot;
                            const figmaFrame = desktopComparison?.figmaFrame;
                            const figmaSource = desktopComparison?.figmaSource;
                            const details = getEvidenceDetails(finding.evidence);

                            if ((screenshot || figmaFrame) && (details.screenshotRegion || figmaFrame)) {
                              return (
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  {screenshot && details.screenshotRegion && (
                                    <div className="rounded-md border border-slate-200 bg-white p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                                        Current State
                                      </p>
                                      <div className="relative w-full overflow-auto bg-slate-50 rounded">
                                        <img
                                          src={screenshot}
                                          alt="Current page screenshot"
                                          className="w-full h-auto"
                                          style={{
                                            border: `2px solid #dc2626`,
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect x='${details.screenshotRegion.x}' y='${details.screenshotRegion.y}' width='${details.screenshotRegion.width}' height='${details.screenshotRegion.height}' fill='none' stroke='red' stroke-width='2' stroke-dasharray='4'/%3E%3C/svg%3E")`,
                                            backgroundRepeat: "repeat",
                                            backgroundSize: "auto",
                                          }}
                                        />
                                      </div>
                                      <p className="mt-2 text-xs text-slate-600">
                                        Issue location: {Math.round(details.screenshotRegion.x)}, {Math.round(details.screenshotRegion.y)} ({Math.round(details.screenshotRegion.width)}×{Math.round(details.screenshotRegion.height)}px)
                                      </p>
                                    </div>
                                  )}
                                  {figmaFrame && (
                                    <div className="rounded-md border border-slate-200 bg-white p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                                        Expected (Figma)
                                      </p>
                                      <div className="w-full overflow-auto bg-slate-50 rounded">
                                        <img
                                          src={figmaFrame}
                                          alt="Figma reference design"
                                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => setEnlargedImage(figmaFrame)}
                                        />
                                      </div>
                                      <p className="mt-2 text-xs text-slate-500">
                                        Source: {formatArtifactSource(figmaSource)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="mt-3 grid gap-2 text-xs text-slate-600">
                            {(() => {
                              const details = getEvidenceDetails(finding.evidence);
                              return (
                                <>
                                  {details.domSelector && (
                                    <p>
                                      <span className="font-semibold text-slate-700">Selector:</span> {details.domSelector}
                                    </p>
                                  )}
                                  {details.computedValue && (
                                    <p>
                                      <span className="font-semibold text-slate-700">Observed:</span> {details.computedValue}
                                    </p>
                                  )}
                                  {details.expectedValue && (
                                    <p>
                                      <span className="font-semibold text-slate-700">Expected:</span> {details.expectedValue}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {(() => {
                            const details = getEvidenceDetails(finding.evidence);
                            return (
                              <>
                                {details.developerReasoning && (
                                  <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Developer reasoning
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">{details.developerReasoning}</p>
                                  </div>
                                )}

                                {details.nextSteps.length > 0 && (
                                  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                      Next steps to fix
                                    </p>
                                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-blue-900">
                                      {details.nextSteps.map((step) => (
                                        <li key={step}>{step}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
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