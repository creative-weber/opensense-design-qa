// ─── Figma Node Tree Normalizer ───────────────────────────────────────────────
//
// Converts the raw Figma nodes API response into a flat, comparison-ready
// array of FigmaSnapshot entries — one per visible leaf node.

// ─── Types: raw Figma API shapes ──────────────────────────────────────────────

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaFill {
  type: string;
  visible?: boolean;
  color?: FigmaColor;
}

interface FigmaAbsoluteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FigmaStyle {
  fontSize?: number;
  fontWeight?: number;
  [key: string]: unknown;
}

/** Subset of the raw node shape returned by the Figma nodes API. */
export interface FigmaRawNode {
  id: string;
  name: string;
  type: string;
  /** When `false` the node is hidden. Omitted means visible. */
  visible?: boolean;
  absoluteBoundingBox?: FigmaAbsoluteBounds;
  fills?: FigmaFill[];
  style?: FigmaStyle;
  children?: FigmaRawNode[];
  [key: string]: unknown;
}

/** The top-level response from GET /v1/files/{fileKey}/nodes */
export interface FigmaNodesApiResponse {
  nodes: Record<
    string,
    {
      document: FigmaRawNode;
      [key: string]: unknown;
    }
  >;
  [key: string]: unknown;
}

// ─── Output type ──────────────────────────────────────────────────────────────

/** A single normalized node entry, ready for visual comparison. */
export interface FigmaSnapshot {
  id: string;
  name: string;
  type: string;
  absoluteBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** RGBA fill colors from visible SOLID fills. Empty if none. */
  fillColors: Array<{ r: number; g: number; b: number; a: number }>;
  /** Font size in px, or `null` if not applicable. */
  fontSize: number | null;
  /** Numeric font weight (e.g. 400, 700), or `null` if not applicable. */
  fontWeight: number | null;
  visible: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isVisible(node: FigmaRawNode): boolean {
  return node.visible !== false;
}

function extractFillColors(
  fills: FigmaFill[] | undefined
): Array<{ r: number; g: number; b: number; a: number }> {
  if (!fills) return [];
  return fills
    .filter((f) => f.type === "SOLID" && f.visible !== false && f.color != null)
    .map((f) => ({
      r: f.color!.r,
      g: f.color!.g,
      b: f.color!.b,
      a: f.color!.a,
    }));
}

function toSnapshot(node: FigmaRawNode): FigmaSnapshot {
  const bounds = node.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    absoluteBounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    fillColors: extractFillColors(node.fills),
    fontSize: node.style?.fontSize ?? null,
    fontWeight: node.style?.fontWeight ?? null,
    visible: true,
  };
}

/**
 * Recursively walks the node tree and collects all visible leaf nodes.
 * A leaf is any node whose `children` array is absent or empty.
 */
function collectLeaves(node: FigmaRawNode, results: FigmaSnapshot[]): void {
  if (!isVisible(node)) return;

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  if (!hasChildren) {
    results.push(toSnapshot(node));
    return;
  }

  for (const child of node.children!) {
    collectLeaves(child, results);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Normalises a raw Figma nodes API response into a flat array of
 * `FigmaSnapshot` entries covering every visible leaf node in the tree.
 *
 * @param response  The parsed JSON body from GET /v1/files/{key}/nodes
 * @param nodeId    The node ID that was requested (used to locate the root)
 * @returns         Flat array of comparison-ready snapshot entries
 */
export function normalizeFigmaNodeTree(
  response: FigmaNodesApiResponse,
  nodeId: string
): FigmaSnapshot[] {
  // The API may key the result by the decoded or encoded node ID.
  const entry =
    response.nodes[nodeId] ??
    response.nodes[encodeURIComponent(nodeId)] ??
    response.nodes[decodeURIComponent(nodeId)];

  if (!entry) {
    return [];
  }

  const snapshots: FigmaSnapshot[] = [];
  collectLeaves(entry.document, snapshots);
  return snapshots;
}
