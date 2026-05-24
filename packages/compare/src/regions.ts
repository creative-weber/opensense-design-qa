import sharp from "sharp";
import type { DiffResult, ImageBuffer } from "./types.js";

/** How a mismatch region is classified. */
export type RegionType = "missing" | "misaligned" | "restyled";

/** A rectangular mismatch region identified by the connected-component pass. */
export interface DiffRegion {
  /** Left edge of the bounding box in pixels. */
  x: number;
  /** Top edge of the bounding box in pixels. */
  y: number;
  /** Width of the bounding box in pixels. */
  width: number;
  /** Height of the bounding box in pixels. */
  height: number;
  /** Area of the bounding box (width x height) in pixels squared. */
  area: number;
  /** Number of mismatch pixels belonging to this connected component. */
  mismatchPixels: number;
  /** How the region was classified. */
  type: RegionType;
}

const NOISE_THRESHOLD_PX2 = 100;
const MISSING_LIVE_THRESHOLD = 0.12;
const MISSING_REF_CONTENT_THRESHOLD = 0.15;
const SHIFT_BRIGHTNESS_DELTA = 0.25;

export async function clusterRegions(
  imageA: ImageBuffer,
  imageB: ImageBuffer,
  diffResult: DiffResult,
): Promise<DiffRegion[]> {
  const { diffBuffer, width, height } = diffResult;

  const resizeOpts = { fit: "contain" as const, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const [rawDiff, rawRef, rawLive] = await Promise.all([
    sharp(diffBuffer).raw().toBuffer(),
    sharp(imageA).resize(width, height, resizeOpts).raw().toBuffer(),
    sharp(imageB).resize(width, height, resizeOpts).raw().toBuffer(),
  ]);

  const mismatch = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rawDiff[i * 4] ?? 0;
    const g = rawDiff[i * 4 + 1] ?? 0;
    const b = rawDiff[i * 4 + 2] ?? 0;
    if (r > 200 && g < 50 && b < 50) {
      mismatch[i] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const regions: DiffRegion[] = [];

  for (let seed = 0; seed < width * height; seed++) {
    if (!mismatch[seed] || visited[seed]) continue;

    const queue: number[] = [seed];
    visited[seed] = 1;
    let head = 0;

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (head < queue.length) {
      const idx = queue[head++]!;
      const cx = idx % width;
      const cy = (idx - cx) / width;

      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      const candidates: [number, number][] = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx,     cy - 1],
        [cx,     cy + 1],
      ];

      for (const [nx, ny] of candidates) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (mismatch[ni] && !visited[ni]) {
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }

    const bboxW = maxX - minX + 1;
    const bboxH = maxY - minY + 1;
    const area = bboxW * bboxH;

    if (area < NOISE_THRESHOLD_PX2) continue;

    const mismatchPixels = queue.length;
    const type = classifyRegion(rawRef, rawLive, width, minX, minY, bboxW, bboxH);

    regions.push({ x: minX, y: minY, width: bboxW, height: bboxH, area, mismatchPixels, type });
  }

  return regions;
}

function classifyRegion(
  rawRef: Buffer,
  rawLive: Buffer,
  imageWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
): RegionType {
  let refBrightness = 0;
  let liveBrightness = 0;
  const sampleCount = w * h;

  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const base = (row * imageWidth + col) * 4;

      const rr = rawRef[base] ?? 0;
      const rg = rawRef[base + 1] ?? 0;
      const rb = rawRef[base + 2] ?? 0;
      refBrightness += (rr + rg + rb) / (3 * 255);

      const lr = rawLive[base] ?? 0;
      const lg = rawLive[base + 1] ?? 0;
      const lb = rawLive[base + 2] ?? 0;
      liveBrightness += (lr + lg + lb) / (3 * 255);
    }
  }

  const avgRef  = sampleCount > 0 ? refBrightness  / sampleCount : 0;
  const avgLive = sampleCount > 0 ? liveBrightness / sampleCount : 0;

  if (avgLive < MISSING_LIVE_THRESHOLD && avgRef > MISSING_REF_CONTENT_THRESHOLD) {
    return "missing";
  }

  if (Math.abs(avgRef - avgLive) > SHIFT_BRIGHTNESS_DELTA) {
    return "misaligned";
  }

  return "restyled";
}
