"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import type { ViewportComparison } from "../app/runs/[id]/artifactComparisons";

type ViewMode = "side-by-side" | "overlay" | "diff";

type RegionType = "missing" | "misaligned" | "restyled";

const REGION_TYPE_LABELS: Record<RegionType, string> = {
  missing: "Missing",
  misaligned: "Misaligned",
  restyled: "Restyled",
};

const REGION_BORDER_COLORS: Record<RegionType, string> = {
  missing: "#ef4444",
  misaligned: "#f59e0b",
  restyled: "#22c55e",
};

export type DiffFinding = {
  id: string;
  ruleId: string;
  evidence: Array<{
    screenshotRegion?: { x: number; y: number; width: number; height: number };
  }>;
};

type RegionOverlay = {
  id: string;
  type: RegionType;
  x: number;
  y: number;
  width: number;
  height: number;
};

function regionTypeFromRuleId(ruleId: string): RegionType | null {
  if (ruleId === "figma-diff/missing") return "missing";
  if (ruleId === "figma-diff/misaligned") return "misaligned";
  if (ruleId === "figma-diff/restyled") return "restyled";
  return null;
}

function buildRegionOverlays(findings: DiffFinding[]): RegionOverlay[] {
  return findings.flatMap((finding) => {
    const type = regionTypeFromRuleId(finding.ruleId);
    if (!type) return [];
    return finding.evidence
      .filter((e) => e.screenshotRegion != null)
      .map((e) => ({
        id: `${finding.id}-${e.screenshotRegion!.x}-${e.screenshotRegion!.y}`,
        type,
        x: e.screenshotRegion!.x,
        y: e.screenshotRegion!.y,
        width: e.screenshotRegion!.width,
        height: e.screenshotRegion!.height,
      }));
  });
}

function ImageWithRegionOverlay({
  src,
  alt,
  regions,
  activeRegionTypes,
}: {
  src: string;
  alt: string;
  regions: RegionOverlay[];
  activeRegionTypes: Set<RegionType>;
}) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  return (
    <div className="relative">
      <img
        src={src}
        alt={alt}
        className="w-full h-auto block rounded"
        onLoad={(e) => {
          const img = e.currentTarget;
          setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
      {naturalSize && regions.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {regions
            .filter((r) => activeRegionTypes.has(r.type))
            .map((r) => (
              <rect
                key={r.id}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="transparent"
                stroke={REGION_BORDER_COLORS[r.type]}
                strokeWidth="3"
                rx="2"
              />
            ))}
        </svg>
      )}
    </div>
  );
}

function ViewportPanel({
  comparison,
  viewMode,
  overlayOpacity,
  regions,
  activeRegionTypes,
}: {
  comparison: ViewportComparison;
  viewMode: ViewMode;
  overlayOpacity: number;
  regions: RegionOverlay[];
  activeRegionTypes: Set<RegionType>;
}) {
  const { viewport, screenshot, figmaFrame, diffImage } = comparison;

  if (viewMode === "side-by-side") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Live page
          </p>
          {screenshot ? (
            <ImageWithRegionOverlay
              src={screenshot}
              alt={`${viewport} live page screenshot`}
              regions={regions}
              activeRegionTypes={activeRegionTypes}
            />
          ) : (
            <p className="text-xs text-slate-400">No live screenshot available.</p>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Figma reference
          </p>
          {figmaFrame ? (
            <img
              src={figmaFrame}
              alt={`${viewport} Figma reference`}
              className="w-full h-auto block rounded"
            />
          ) : (
            <p className="text-xs text-slate-400">No Figma frame available.</p>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === "overlay") {
    if (!screenshot || !diffImage) {
      return (
        <p className="text-xs text-slate-400">
          Overlay requires both a live screenshot and a diff image.
        </p>
      );
    }
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="relative">
          <img
            src={screenshot}
            alt={`${viewport} live page screenshot`}
            className="w-full h-auto block rounded"
          />
          <img
            src={diffImage}
            alt={`${viewport} visual diff overlay`}
            className="absolute inset-0 w-full h-full object-fill pointer-events-none rounded"
            style={{ opacity: overlayOpacity / 100 }}
          />
        </div>
      </div>
    );
  }

  // diff mode
  if (!diffImage) {
    return (
      <p className="text-xs text-slate-400">No diff image available for this viewport.</p>
    );
  }
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <img
        src={diffImage}
        alt={`${viewport} visual diff`}
        className="w-full h-auto block rounded"
      />
    </div>
  );
}

type ComparisonViewerProps = {
  comparisons: ViewportComparison[];
  findingsByViewport: Record<string, DiffFinding[]>;
};

export function ComparisonViewer({ comparisons, findingsByViewport }: ComparisonViewerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewMode = (searchParams.get("viewMode") ?? "side-by-side") as ViewMode;
  const overlayOpacity = Math.max(
    0,
    Math.min(100, Number(searchParams.get("overlayOpacity") ?? "70"))
  );
  const activeRegionTypes = new Set<RegionType>(
    (searchParams.get("regionFilter") ?? "missing,misaligned,restyled")
      .split(",")
      .filter((v): v is RegionType => v === "missing" || v === "misaligned" || v === "restyled")
  );

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  function setViewMode(mode: ViewMode) {
    updateParam("viewMode", mode);
  }

  function setOverlayOpacity(value: number) {
    updateParam("overlayOpacity", String(value));
  }

  function toggleRegionType(type: RegionType) {
    const next = new Set(activeRegionTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    updateParam("regionFilter", Array.from(next).join(","));
  }

  const anyDiffImage = comparisons.some((c) => c.diffImage);
  const anyScreenshotAndDiff = comparisons.some((c) => c.screenshot && c.diffImage);
  const allRegionOverlays = Object.values(findingsByViewport).flatMap(buildRegionOverlays);
  const hasDiffFindings = allRegionOverlays.length > 0;

  const viewModeOptions: { mode: ViewMode; label: string; disabled: boolean }[] = [
    { mode: "side-by-side", label: "Side by Side", disabled: false },
    { mode: "overlay", label: "Overlay", disabled: !anyScreenshotAndDiff },
    { mode: "diff", label: "Diff Only", disabled: !anyDiffImage },
  ];

  return (
    <div className="space-y-5">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        {/* View mode toggle */}
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs"
          role="group"
          aria-label="View mode"
        >
          {viewModeOptions.map(({ mode, label, disabled }) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === mode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : disabled
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
              aria-pressed={viewMode === mode}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Opacity slider — only in overlay mode */}
        {viewMode === "overlay" && anyScreenshotAndDiff && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="overlay-opacity"
              className="text-xs font-semibold whitespace-nowrap text-slate-600"
            >
              Diff opacity
            </label>
            <input
              id="overlay-opacity"
              type="range"
              min="0"
              max="100"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-28 accent-indigo-600"
              aria-label="Diff overlay opacity"
            />
            <span className="w-8 text-right text-xs text-slate-500">{overlayOpacity}%</span>
          </div>
        )}

        {/* Region type filter — only when there are figma-diff findings */}
        {hasDiffFindings && (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
            role="group"
            aria-label="Region type filter"
          >
            <span className="text-xs font-semibold text-slate-600">Highlight:</span>
            {(["missing", "misaligned", "restyled"] as RegionType[]).map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={activeRegionTypes.has(type)}
                  onChange={() => toggleRegionType(type)}
                  className="rounded"
                />
                <span className="flex items-center gap-1 text-xs font-medium">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border-2"
                    style={{ borderColor: REGION_BORDER_COLORS[type] }}
                    aria-hidden="true"
                  />
                  <span style={{ color: REGION_BORDER_COLORS[type] }}>
                    {REGION_TYPE_LABELS[type]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Per-viewport panels */}
      {comparisons.map((comparison) => {
        const viewportFindings = findingsByViewport[comparison.viewport] ?? [];
        const regions = buildRegionOverlays(viewportFindings);
        return (
          <article
            key={comparison.viewport}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {comparison.viewport} viewport
            </p>
            <ViewportPanel
              comparison={comparison}
              viewMode={viewMode}
              overlayOpacity={overlayOpacity}
              regions={regions}
              activeRegionTypes={activeRegionTypes}
            />
          </article>
        );
      })}
    </div>
  );
}
