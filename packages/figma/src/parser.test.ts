import { describe, it, expect } from "vitest";
import { parseFigmaFrameReference, isParseError } from "./parser.ts";

// ─── /file/ URL format ────────────────────────────────────────────────────────

describe("parseFigmaFrameReference — /file/ format", () => {
  it("parses a standard /file/ URL with decoded node-id", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/file/abc123/My-Design?node-id=1:2"
    );
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.fileKey).toBe("abc123");
    expect(result.nodeId).toBe("1:2");
  });

  it("parses a /file/ URL with URL-encoded node-id (1%3A2 → 1:2)", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/file/XYZ789/Some-File?node-id=5%3A10"
    );
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.fileKey).toBe("XYZ789");
    expect(result.nodeId).toBe("5:10");
  });

  it("parses a /file/ URL with extra path segments after the file key", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/file/KEY001/Title/extra-segment?node-id=3:7"
    );
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.fileKey).toBe("KEY001");
    expect(result.nodeId).toBe("3:7");
  });
});

// ─── /design/ URL format ──────────────────────────────────────────────────────

describe("parseFigmaFrameReference — /design/ format", () => {
  it("parses a standard /design/ URL with decoded node-id", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/design/DEF456/New-Design?node-id=10:20"
    );
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.fileKey).toBe("DEF456");
    expect(result.nodeId).toBe("10:20");
  });

  it("parses a /design/ URL with URL-encoded node-id", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/design/abc999/Design?node-id=5%3A10"
    );
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.fileKey).toBe("abc999");
    expect(result.nodeId).toBe("5:10");
  });

  it("works with figma.com (no www) domain", () => {
    const result = parseFigmaFrameReference(
      "https://figma.com/design/KEY999/Title?node-id=2:4"
    );
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.fileKey).toBe("KEY999");
    expect(result.nodeId).toBe("2:4");
  });
});

// ─── Malformed / error cases ──────────────────────────────────────────────────

describe("parseFigmaFrameReference — error cases", () => {
  it("returns ParseError for a completely invalid URL string", () => {
    const result = parseFigmaFrameReference("not-a-url");
    expect(isParseError(result)).toBe(true);
    if (!isParseError(result)) return;
    expect(result.kind).toBe("ParseError");
    expect(result.message).toContain("Invalid URL");
  });

  it("returns ParseError for a non-Figma URL", () => {
    const result = parseFigmaFrameReference(
      "https://example.com/file/abc/Design?node-id=1:2"
    );
    expect(isParseError(result)).toBe(true);
    expect((result as { kind: string }).kind).toBe("ParseError");
  });

  it("returns ParseError when /file/ or /design/ segment is missing", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/proto/abc123/Title?node-id=1:2"
    );
    expect(isParseError(result)).toBe(true);
  });

  it("returns ParseError when node-id query param is missing", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/design/abc123/Title"
    );
    expect(isParseError(result)).toBe(true);
    if (!isParseError(result)) return;
    expect(result.message).toContain("node-id");
  });

  it("returns ParseError when file key segment is absent", () => {
    const result = parseFigmaFrameReference(
      "https://www.figma.com/design/?node-id=1:2"
    );
    expect(isParseError(result)).toBe(true);
  });

  it("returns ParseError for an empty string", () => {
    const result = parseFigmaFrameReference("");
    expect(isParseError(result)).toBe(true);
  });
});
