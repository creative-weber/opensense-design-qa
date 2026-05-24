// ─── Figma Frame URL Parser ───────────────────────────────────────────────────
//
// Parses Figma frame URLs into { fileKey, nodeId } for use by the worker and
// any other consumer. Supports both /file/ and /design/ URL formats.

export interface FigmaFrameReference {
  fileKey: string;
  /** Node ID in decoded form, e.g. "1:2" (not "1%3A2"). */
  nodeId: string;
}

export interface ParseError {
  readonly kind: "ParseError";
  readonly message: string;
}

/**
 * Parses a Figma frame URL and returns the file key and node ID.
 *
 * Supported formats:
 *   - https://www.figma.com/file/{fileKey}/...?node-id={nodeId}
 *   - https://www.figma.com/design/{fileKey}/...?node-id={nodeId}
 *
 * @returns `FigmaFrameReference` on success, or a `ParseError` on failure.
 */
export function parseFigmaFrameReference(
  url: string
): FigmaFrameReference | ParseError {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "ParseError", message: `Invalid URL: "${url}"` };
  }

  if (
    parsed.hostname !== "www.figma.com" &&
    parsed.hostname !== "figma.com"
  ) {
    return {
      kind: "ParseError",
      message: `URL hostname "${parsed.hostname}" is not a Figma domain.`,
    };
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  // Pathname: /file/{fileKey}/... or /design/{fileKey}/...
  const typeIdx = parts.findIndex((p) => p === "file" || p === "design");
  if (typeIdx === -1) {
    return {
      kind: "ParseError",
      message: `URL pathname does not contain /file/ or /design/ segment: "${parsed.pathname}"`,
    };
  }

  const fileKey = parts[typeIdx + 1];
  if (!fileKey) {
    return {
      kind: "ParseError",
      message: `No file key found after /${parts[typeIdx]}/ in URL: "${url}"`,
    };
  }

  const rawNodeId = parsed.searchParams.get("node-id");
  if (!rawNodeId) {
    return {
      kind: "ParseError",
      message: `Missing "node-id" query parameter in URL: "${url}"`,
    };
  }

  // node-id may be URL-encoded (e.g. "1%3A2" → "1:2")
  const nodeId = decodeURIComponent(rawNodeId);

  return { fileKey, nodeId };
}

/**
 * Type guard that checks whether a parse result is a `ParseError`.
 */
export function isParseError(
  result: FigmaFrameReference | ParseError
): result is ParseError {
  return (result as ParseError).kind === "ParseError";
}
