import { describe, it, expect } from "vitest";
import {
  normalizeFigmaNodeTree,
  type FigmaNodesApiResponse,
  type FigmaSnapshot,
} from "./normalizer.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
//
// Represents a simplified but realistic Figma nodes API response.
// Tree structure:
//
//   FRAME "Card" (visible)
//   ├─ TEXT "Title" (visible, has style)
//   ├─ RECTANGLE "Hero Image" (visible, has fill)
//   ├─ FRAME "Inner Group" (visible, has children → not a leaf)
//   │   ├─ TEXT "Subtitle" (visible)
//   │   └─ RECTANGLE "Divider" (invisible → excluded)
//   └─ VECTOR "Icon" (invisible → excluded)

const FIXTURE: FigmaNodesApiResponse = {
  nodes: {
    "1:10": {
      document: {
        id: "1:10",
        name: "Card",
        type: "FRAME",
        visible: true,
        absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
        fills: [],
        children: [
          {
            id: "1:11",
            name: "Title",
            type: "TEXT",
            visible: true,
            absoluteBoundingBox: { x: 10, y: 10, width: 200, height: 24 },
            fills: [
              { type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } },
            ],
            style: { fontSize: 20, fontWeight: 700 },
          },
          {
            id: "1:12",
            name: "Hero Image",
            type: "RECTANGLE",
            visible: true,
            absoluteBoundingBox: { x: 10, y: 40, width: 380, height: 160 },
            fills: [
              { type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8, a: 1 } },
              // IMAGE fill should be ignored (not SOLID)
              { type: "IMAGE" },
            ],
          },
          {
            id: "1:13",
            name: "Inner Group",
            type: "FRAME",
            visible: true,
            absoluteBoundingBox: { x: 10, y: 210, width: 380, height: 80 },
            fills: [],
            children: [
              {
                id: "1:14",
                name: "Subtitle",
                type: "TEXT",
                visible: true,
                absoluteBoundingBox: { x: 10, y: 215, width: 180, height: 18 },
                fills: [
                  { type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3, a: 1 } },
                ],
                style: { fontSize: 14, fontWeight: 400 },
              },
              {
                id: "1:15",
                name: "Divider",
                type: "RECTANGLE",
                // invisible → must be excluded
                visible: false,
                absoluteBoundingBox: { x: 10, y: 240, width: 380, height: 1 },
                fills: [],
              },
            ],
          },
          {
            id: "1:16",
            name: "Icon",
            type: "VECTOR",
            // invisible → must be excluded
            visible: false,
            absoluteBoundingBox: { x: 350, y: 10, width: 24, height: 24 },
            fills: [],
          },
        ],
      },
    },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeFigmaNodeTree", () => {
  it("returns the correct number of visible leaf nodes", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    // Leaves: Title (1:11), Hero Image (1:12), Subtitle (1:14)
    // Excluded: Divider (invisible), Icon (invisible), Card/Inner Group (have children)
    expect(snapshots).toHaveLength(3);
  });

  it("each snapshot has the required fields", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    for (const snap of snapshots) {
      expect(snap).toHaveProperty("id");
      expect(snap).toHaveProperty("name");
      expect(snap).toHaveProperty("type");
      expect(snap).toHaveProperty("absoluteBounds");
      expect(snap.absoluteBounds).toHaveProperty("x");
      expect(snap.absoluteBounds).toHaveProperty("y");
      expect(snap.absoluteBounds).toHaveProperty("width");
      expect(snap.absoluteBounds).toHaveProperty("height");
      expect(snap).toHaveProperty("fillColors");
      expect(snap).toHaveProperty("fontSize");
      expect(snap).toHaveProperty("fontWeight");
      expect(snap).toHaveProperty("visible");
    }
  });

  it("normalizes the Title node correctly", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    const title = snapshots.find((s) => s.id === "1:11");
    expect(title).toBeDefined();
    const expected: FigmaSnapshot = {
      id: "1:11",
      name: "Title",
      type: "TEXT",
      absoluteBounds: { x: 10, y: 10, width: 200, height: 24 },
      fillColors: [{ r: 0, g: 0, b: 0, a: 1 }],
      fontSize: 20,
      fontWeight: 700,
      visible: true,
    };
    expect(title).toEqual(expected);
  });

  it("extracts only SOLID fill colors and ignores IMAGE fills", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    const hero = snapshots.find((s) => s.id === "1:12");
    expect(hero).toBeDefined();
    expect(hero!.fillColors).toHaveLength(1);
    expect(hero!.fillColors[0]).toEqual({ r: 0.2, g: 0.4, b: 0.8, a: 1 });
  });

  it("sets fontSize and fontWeight to null for non-text nodes", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    const hero = snapshots.find((s) => s.id === "1:12");
    expect(hero!.fontSize).toBeNull();
    expect(hero!.fontWeight).toBeNull();
  });

  it("excludes invisible nodes", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    const ids = snapshots.map((s) => s.id);
    expect(ids).not.toContain("1:15"); // Divider (visible: false)
    expect(ids).not.toContain("1:16"); // Icon (visible: false)
  });

  it("recurses into inner groups to collect their leaf nodes", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    const subtitle = snapshots.find((s) => s.id === "1:14");
    expect(subtitle).toBeDefined();
    expect(subtitle!.name).toBe("Subtitle");
    expect(subtitle!.fontSize).toBe(14);
    expect(subtitle!.fontWeight).toBe(400);
  });

  it("does not include intermediate group nodes (only leaves)", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    const ids = snapshots.map((s) => s.id);
    expect(ids).not.toContain("1:10"); // Card (root frame, has children)
    expect(ids).not.toContain("1:13"); // Inner Group (has children)
  });

  it("all visible fields are true", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "1:10");
    for (const snap of snapshots) {
      expect(snap.visible).toBe(true);
    }
  });

  it("returns an empty array when the requested node ID is not in the response", () => {
    const snapshots = normalizeFigmaNodeTree(FIXTURE, "9:99");
    expect(snapshots).toEqual([]);
  });

  it("returns an empty array for an empty nodes response", () => {
    const snapshots = normalizeFigmaNodeTree({ nodes: {} }, "1:10");
    expect(snapshots).toEqual([]);
  });

  it("handles a root node with no children (single leaf at root)", () => {
    const singleNode: FigmaNodesApiResponse = {
      nodes: {
        "2:1": {
          document: {
            id: "2:1",
            name: "Solo",
            type: "RECTANGLE",
            visible: true,
            absoluteBoundingBox: { x: 5, y: 5, width: 50, height: 50 },
            fills: [],
          },
        },
      },
    };
    const snapshots = normalizeFigmaNodeTree(singleNode, "2:1");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.id).toBe("2:1");
  });
});
