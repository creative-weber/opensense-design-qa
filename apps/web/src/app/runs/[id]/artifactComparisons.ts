export type ViewportRunSummary = {
  viewport: string;
};

export type ArtifactResponse = {
  artifactType: "screenshot" | "diff_image" | "figma_frame";
  viewport: string;
  signedUrl?: string;
  source?: "page_capture_stub" | "direct_image_url" | "figma_api" | "fallback_placeholder";
};

export type ViewportComparison = {
  viewport: string;
  screenshot?: string;
  figmaFrame?: string;
  figmaSource?: ArtifactResponse["source"];
};

export function buildViewportComparisons(
  viewportRuns: ViewportRunSummary[],
  artifacts: ArtifactResponse[]
): ViewportComparison[] {
  return viewportRuns.map((viewportRun) => {
    const screenshot = artifacts.find(
      (artifact) => artifact.viewport === viewportRun.viewport && artifact.artifactType === "screenshot"
    )?.signedUrl;
    const figmaArtifact = artifacts.find(
      (artifact) => artifact.viewport === viewportRun.viewport && artifact.artifactType === "figma_frame"
    );
    const figmaFrame = figmaArtifact?.signedUrl;
    const figmaSource = figmaArtifact?.source;

    return {
      viewport: viewportRun.viewport,
      screenshot,
      figmaFrame,
      figmaSource,
    };
  });
}
