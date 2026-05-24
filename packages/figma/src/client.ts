// ─── Figma API Client ─────────────────────────────────────────────────────────
//
// Authenticated client for the Figma REST API.
// Reads FIGMA_ACCESS_TOKEN from the environment.

const FIGMA_API_BASE = "https://api.figma.com/v1";
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

export interface FigmaFileResponse {
  document: FigmaNode;
  name: string;
  lastModified: string;
  version: string;
  // Additional fields from the Figma API are preserved as-is.
  [key: string]: unknown;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  [key: string]: unknown;
}

export interface FigmaFrameImageResult {
  /** URL of the rendered PNG image for the node. */
  imageUrl: string;
  /** Raw PNG image data as a Buffer. */
  imageBuffer: Buffer;
}

export class FigmaClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "FigmaClientError";
  }
}

export class FigmaRateLimitError extends FigmaClientError {
  constructor(retryAfterMs: number) {
    super(`Figma API rate limit exceeded. Retry after ${retryAfterMs}ms.`, 429);
    this.name = "FigmaRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
  retryAfterMs: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env["FIGMA_ACCESS_TOKEN"];
  if (!token) {
    throw new FigmaClientError(
      "FIGMA_ACCESS_TOKEN environment variable is not set."
    );
  }
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function figmaFetch(
  url: string,
  token: string,
  maxRetries = DEFAULT_MAX_RETRIES
): Promise<Response> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    const response = await fetch(url, {
      headers: { "X-Figma-Token": token },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("Retry-After") ?? "1",
        10
      );
      const delayMs = (isNaN(retryAfter) ? 1 : retryAfter) * 1_000;

      if (attempt === maxRetries) {
        throw new FigmaRateLimitError(delayMs);
      }

      await sleep(delayMs);
      attempt++;
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new FigmaClientError(
        `Figma API error ${response.status}: ${body}`,
        response.status
      );
    }

    return response;
  }

  // Should never reach here, but satisfies TypeScript exhaustiveness.
  throw new FigmaClientError("Exceeded max retries for Figma API request.");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the full Figma file document for the given `fileKey`.
 *
 * @param fileKey - The Figma file key extracted from the file URL.
 */
export async function getFile(fileKey: string): Promise<FigmaFileResponse> {
  const token = getToken();
  const url = `${FIGMA_API_BASE}/files/${encodeURIComponent(fileKey)}`;
  const response = await figmaFetch(url, token);
  return response.json() as Promise<FigmaFileResponse>;
}

/**
 * Renders a Figma frame/node as a 2× PNG and returns its URL and raw buffer.
 *
 * @param fileKey - The Figma file key.
 * @param nodeId  - The node ID of the frame to render (e.g. `"1:2"` or `"1%3A2"`).
 */
export async function getFrameImage(
  fileKey: string,
  nodeId: string
): Promise<FigmaFrameImageResult> {
  const token = getToken();
  const encodedNodeId = encodeURIComponent(nodeId);
  const imagesUrl = `${FIGMA_API_BASE}/images/${encodeURIComponent(fileKey)}?ids=${encodedNodeId}&scale=2&format=png`;

  const imagesResponse = await figmaFetch(imagesUrl, token);
  const imagesJson = (await imagesResponse.json()) as {
    images?: Record<string, string | null>;
    err?: string;
  };

  if (imagesJson.err) {
    throw new FigmaClientError(`Figma images API error: ${imagesJson.err}`);
  }

  // The API may return the key in decoded or encoded form.
  const imageUrl =
    imagesJson.images?.[nodeId] ?? imagesJson.images?.[encodedNodeId];
  if (!imageUrl) {
    throw new FigmaClientError(
      `No image URL returned for node "${nodeId}" in file "${fileKey}".`
    );
  }

  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) {
    throw new FigmaClientError(
      `Failed to download Figma frame image: HTTP ${imgResponse.status}`
    );
  }

  const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
  return { imageUrl, imageBuffer };
}
