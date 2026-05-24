import { describe, expect, it } from "vitest";
import { buildViewportComparisons, type ArtifactResponse } from "./artifactComparisons";

describe("buildViewportComparisons", () => {
  it("maps both page and figma screenshot URLs per viewport", () => {
    const comparisons = buildViewportComparisons(
      [{ viewport: "desktop" }, { viewport: "mobile" }],
      [
        {
          artifactType: "screenshot",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-screenshot.svg",
        },
        {
          artifactType: "figma_frame",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-figma.svg",
          source: "figma_api",
        },
        {
          artifactType: "screenshot",
          viewport: "mobile",
          signedUrl: "http://localhost:3000/artifacts/mobile-screenshot.svg",
        },
      ] satisfies ArtifactResponse[]
    );

    expect(comparisons).toEqual([
      {
        viewport: "desktop",
        screenshot: "http://localhost:3000/artifacts/desktop-screenshot.svg",
        figmaFrame: "http://localhost:3000/artifacts/desktop-figma.svg",
        figmaSource: "figma_api",
      },
      {
        viewport: "mobile",
        screenshot: "http://localhost:3000/artifacts/mobile-screenshot.svg",
        figmaFrame: undefined,
        figmaSource: undefined,
      },
    ]);
  });

  it("selects screenshot even when figma artifact appears first", () => {
    const comparisons = buildViewportComparisons(
      [{ viewport: "desktop" }],
      [
        {
          artifactType: "figma_frame",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-figma.svg",
          source: "fallback_placeholder",
        },
        {
          artifactType: "screenshot",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-screenshot.svg",
        },
      ] satisfies ArtifactResponse[]
    );

    expect(comparisons[0]).toEqual({
      viewport: "desktop",
      screenshot: "http://localhost:3000/artifacts/desktop-screenshot.svg",
      figmaFrame: "http://localhost:3000/artifacts/desktop-figma.svg",
      figmaSource: "fallback_placeholder",
      diffImage: undefined,
    });
  });

  it("includes diffImage when a diff_image artifact is present", () => {
    const comparisons = buildViewportComparisons(
      [{ viewport: "desktop" }],
      [
        {
          artifactType: "screenshot",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-screenshot.svg",
        },
        {
          artifactType: "figma_frame",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-figma.svg",
          source: "figma_api",
        },
        {
          artifactType: "diff_image",
          viewport: "desktop",
          signedUrl: "http://localhost:3000/artifacts/desktop-diff.png",
        },
      ] satisfies ArtifactResponse[]
    );

    expect(comparisons[0].diffImage).toBe("http://localhost:3000/artifacts/desktop-diff.png");
  });
});
