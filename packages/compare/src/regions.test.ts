import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { diff } from "./diff.js";
import { clusterRegions } from "./regions.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function solidPng(w: number, h: number, r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

/**
 * Build a PNG with a coloured rectangle composited over a white background.
 * Used to simulate UI elements at different positions.
 */
async function rectOnWhite(
  canvasW: number,
  canvasH: number,
  rectW: number,
  rectH: number,
  left: number,
  top: number,
  r: number,
  g: number,
  b: number,
): Promise<Buffer> {
  const rect = await sharp({
    create: { width: rectW, height: rectH, channels: 4, background: { r, g, b, alpha: 255 } },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .composite([{ input: rect, left, top }])
    .png()
    .toBuffer();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("clusterRegions()", () => {
  it("returns empty array when images are identical (clean match)", async () => {
    const img = await solidPng(50, 50, 200, 100, 50);
    const diffResult = await diff(img, img);
    const regions = await clusterRegions(img, img, diffResult);

    expect(regions).toHaveLength(0);
  });

  it("classifies a region as 'missing' when live screenshot is dark/blank", async () => {
    // imageA (Figma): white background with a bright green 30×30 block at (10,10).
    // imageB (live): all-black — element completely absent from live.
    const imageA = await rectOnWhite(80, 80, 30, 30, 10, 10, 0, 220, 0);
    const imageB = await solidPng(80, 80, 0, 0, 0);       // black = blank live

    const diffResult = await diff(imageA, imageB);
    const regions = await clusterRegions(imageA, imageB, diffResult);

    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every((r) => r.type === "missing")).toBe(true);
  });

  it("classifies a region as 'misaligned' when an element is shifted", async () => {
    // Same 20×20 red block shifted 15 pixels to the right between A and B.
    // Both images have a white background so live is not blank.
    const imageA = await rectOnWhite(80, 80, 20, 20,  5, 30, 220, 0, 0);
    const imageB = await rectOnWhite(80, 80, 20, 20, 20, 30, 220, 0, 0);

    const diffResult = await diff(imageA, imageB);
    const regions = await clusterRegions(imageA, imageB, diffResult);

    // At least one region should exist and be classified as misaligned.
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some((r) => r.type === "misaligned")).toBe(true);
  });

  it("discards noise regions smaller than 100 px²", async () => {
    // imageA: white canvas with a 5×5 (= 25 px²) red dot at (5,5).
    // imageB: white canvas — the dot is absent.
    // The mismatch region bounding box ≈ 5×5 = 25 px² < noise threshold.
    const imageA = await rectOnWhite(60, 60, 5, 5, 5, 5, 255, 0, 0);
    const imageB = await solidPng(60, 60, 255, 255, 255);

    const diffResult = await diff(imageA, imageB);
    const regions = await clusterRegions(imageA, imageB, diffResult);

    expect(regions).toHaveLength(0);
  });

  it("classifies a region as 'restyled' when element is present but colour changed", async () => {
    // imageA: large 40×40 red block on white.
    // imageB: same position but blue block — element repainted in place.
    const imageA = await rectOnWhite(80, 80, 40, 40, 10, 10, 220, 0,   0);
    const imageB = await rectOnWhite(80, 80, 40, 40, 10, 10,   0, 0, 220);

    const diffResult = await diff(imageA, imageB);
    const regions = await clusterRegions(imageA, imageB, diffResult);

    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some((r) => r.type === "restyled")).toBe(true);
  });

  it("returns correct bounding-box geometry for a mismatch region", async () => {
    // 30×20 block at (10, 15) changed colour → bounding box should be ≈ 30×20 at (10,15).
    const imageA = await rectOnWhite(80, 80, 30, 20, 10, 15, 255, 0,   0);
    const imageB = await rectOnWhite(80, 80, 30, 20, 10, 15,   0, 0, 255);

    const diffResult = await diff(imageA, imageB);
    const regions = await clusterRegions(imageA, imageB, diffResult);

    expect(regions.length).toBeGreaterThan(0);

    const region = regions[0]!;
    // Bounding box should contain the 30×20 block at (10,15).
    expect(region.x).toBeLessThanOrEqual(10);
    expect(region.y).toBeLessThanOrEqual(15);
    expect(region.x + region.width).toBeGreaterThanOrEqual(10 + 30);
    expect(region.y + region.height).toBeGreaterThanOrEqual(15 + 20);
  });
});
