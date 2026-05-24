/** Raw pixel buffer from a screenshot (PNG). */
export type ImageBuffer = Buffer;

/** Result of a pixel-level diff between two images. */
export interface DiffResult {
  /** PNG buffer of the diff image (red pixels mark mismatches). */
  diffBuffer: Buffer;
  /** Fraction of pixels that differ, in the range [0, 1]. */
  mismatchRatio: number;
  /** Absolute count of mismatching pixels. */
  mismatchCount: number;
  /** Width of the compared images in pixels. */
  width: number;
  /** Height of the compared images in pixels. */
  height: number;
}

/** Options forwarded to Pixelmatch and Sharp resizing. */
export interface DiffOptions {
  /**
   * Matching threshold, ranges from 0 to 1.
   * A lower value makes the comparison more sensitive.
   * @default 0.1
   */
  threshold?: number;
  /**
   * When true, the diff image is rendered as a greyscale image with
   * mismatched pixels highlighted in red.
   * @default true
   */
  includeAA?: boolean;
}
