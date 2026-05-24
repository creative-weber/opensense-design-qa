import sharp from "sharp";
import pixelmatch from "pixelmatch";
import type { DiffOptions, DiffResult, ImageBuffer } from "./types.js";

/**
 * Compare two PNG screenshots pixel-by-pixel.
 *
 * Both images are decoded with Sharp.  If their dimensions differ the smaller
 * image is resized to match the larger one before comparison so that the diff
 * is always performed on identically-sized canvases.
 *
 * @param imageA - PNG buffer for the first image (e.g. live screenshot).
 * @param imageB - PNG buffer for the second image (e.g. Figma frame render).
 * @param options - Optional Pixelmatch tuning parameters.
 * @returns A {@link DiffResult} containing the diff PNG buffer, mismatch ratio,
 *          and mismatch count.
 */
export async function diff(
  imageA: ImageBuffer,
  imageB: ImageBuffer,
  options: DiffOptions = {},
): Promise<DiffResult> {
  const { threshold = 0.1, includeAA = true } = options;

  // Decode both images to raw RGBA pixel data.
  let metaA: sharp.Metadata;
  let metaB: sharp.Metadata;
  try {
    [metaA, metaB] = await Promise.all([
      sharp(imageA).metadata(),
      sharp(imageB).metadata(),
    ]);
  } catch (cause) {
    throw new CompareError(
      `Failed to decode image: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const width = Math.max(metaA.width ?? 0, metaB.width ?? 0);
  const height = Math.max(metaA.height ?? 0, metaB.height ?? 0);

  if (width === 0 || height === 0) {
    throw new CompareError("One or both images have zero dimensions.");
  }

  // Resize both to the canonical canvas (no-op when dimensions already match).
  const [rawA, rawB] = await Promise.all([
    sharp(imageA)
      .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer(),
    sharp(imageB)
      .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer(),
  ]);

  // Pixelmatch expects Uint8Array views over the raw RGBA buffers.
  const diffData = new Uint8Array(width * height * 4);

  const mismatchCount = pixelmatch(
    new Uint8Array(rawA.buffer),
    new Uint8Array(rawB.buffer),
    diffData,
    width,
    height,
    { threshold, includeAA },
  );

  // Encode the diff data back to a PNG buffer via Sharp.
  const diffBuffer = await sharp(Buffer.from(diffData), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  const totalPixels = width * height;
  const mismatchRatio = totalPixels > 0 ? mismatchCount / totalPixels : 0;

  return { diffBuffer, mismatchRatio, mismatchCount, width, height };
}

/** Thrown when the compare package encounters an irrecoverable error. */
export class CompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompareError";
  }
}
