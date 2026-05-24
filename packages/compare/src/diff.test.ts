import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { diff, CompareError } from "./diff.js";

/** Generate a solid-colour PNG buffer of the given size. */
async function solidPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

/**
 * Generate a PNG with a small coloured square composited over a white
 * background.  Used to simulate a shifted UI element between two screenshots.
 */
async function squareOnWhite(
  canvasW: number,
  canvasH: number,
  squareSize: number,
  left: number,
  top: number,
  r: number,
  g: number,
  b: number,
): Promise<Buffer> {
  const square = await sharp({
    create: { width: squareSize, height: squareSize, channels: 4, background: { r, g, b, alpha: 255 } },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .composite([{ input: square, left, top }])
    .png()
    .toBuffer();
}

describe("diff()", () => {
  it("returns zero mismatch for identical images", async () => {
    const img = await solidPng(10, 10, 255, 0, 0);
    const result = await diff(img, img);

    expect(result.mismatchCount).toBe(0);
    expect(result.mismatchRatio).toBe(0);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it("returns non-zero mismatch for completely different images", async () => {
    const red = await solidPng(10, 10, 255, 0, 0);
    const blue = await solidPng(10, 10, 0, 0, 255);
    const result = await diff(red, blue);

    expect(result.mismatchCount).toBeGreaterThan(0);
    expect(result.mismatchRatio).toBeGreaterThan(0);
    expect(result.mismatchRatio).toBeLessThanOrEqual(1);
  });

  it("returns a PNG buffer in diffBuffer", async () => {
    const img = await solidPng(8, 8, 128, 128, 128);
    const result = await diff(img, img);

    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(result.diffBuffer[0]).toBe(0x89);
    expect(result.diffBuffer[1]).toBe(0x50);
    expect(result.diffBuffer[2]).toBe(0x4e);
    expect(result.diffBuffer[3]).toBe(0x47);
  });

  it("handles images with different sizes by scaling to the larger canvas", async () => {
    const small = await solidPng(8, 8, 255, 0, 0);
    const large = await solidPng(16, 16, 255, 0, 0);
    const result = await diff(small, large);

    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });

  it("respects the threshold option — high threshold ignores minor differences", async () => {
    // Two nearly identical colours: 200 vs 205 in red channel.
    const a = await solidPng(10, 10, 200, 100, 100);
    const b = await solidPng(10, 10, 205, 100, 100);

    const strict = await diff(a, b, { threshold: 0.01 });
    const lenient = await diff(a, b, { threshold: 0.5 });

    expect(strict.mismatchCount).toBeGreaterThanOrEqual(lenient.mismatchCount);
  });

  it("detects mismatches between shifted images (same content, different position)", async () => {
    // A 20×20 blue square on a white 50×50 canvas, shifted 8 pixels to the right.
    const imageA = await squareOnWhite(50, 50, 20, 5,  5,  0, 0, 255);
    const imageB = await squareOnWhite(50, 50, 20, 13, 5,  0, 0, 255);
    const result = await diff(imageA, imageB);

    // The shift creates mismatches in the moved area but NOT everywhere —
    // mismatch should be partial (> 0 but < 100 %).
    expect(result.mismatchCount).toBeGreaterThan(0);
    expect(result.mismatchRatio).toBeGreaterThan(0);
    expect(result.mismatchRatio).toBeLessThan(1);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });

  it("throws CompareError when an image buffer is empty", async () => {
    const valid = await solidPng(4, 4, 0, 0, 0);
    await expect(diff(Buffer.alloc(0), valid)).rejects.toBeInstanceOf(CompareError);
  });
});
