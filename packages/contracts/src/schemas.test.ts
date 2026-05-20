import { describe, it, expect } from "vitest";
import {
  CreateRunSchema,
  CreateProjectSchema,
  AuditJobSchema,
  CreateIgnoreRuleSchema,
  FindingSchema,
  FindingSeveritySchema,
  ViewportPresetSchema,
  ViewportDimensionsSchema,
  ExportFormatSchema,
  parseOrThrow,
  safeParse,
} from "../src/schemas.js";
import { VIEWPORT_PRESETS } from "../src/types.js";

// ─── CreateProjectSchema ──────────────────────────────────────────────────────

describe("CreateProjectSchema", () => {
  it("accepts a valid project name", () => {
    const result = CreateProjectSchema.safeParse({ name: "My Project" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = CreateProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 200 characters", () => {
    const result = CreateProjectSchema.safeParse({ name: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts a name with exactly 200 characters", () => {
    const result = CreateProjectSchema.safeParse({ name: "x".repeat(200) });
    expect(result.success).toBe(true);
  });
});

// ─── CreateRunSchema ──────────────────────────────────────────────────────────

describe("CreateRunSchema", () => {
  const validBase = {
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    url: "https://example.com",
    viewports: ["desktop"] as const,
  };

  it("accepts a valid run request with one viewport", () => {
    const result = CreateRunSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("accepts a valid run request with all three viewports", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      viewports: ["desktop", "tablet", "mobile"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional figmaFrameUrl", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      figmaFrameUrl: "https://www.figma.com/file/abc123/Frame",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null figmaFrameUrl", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      figmaFrameUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID projectId", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      projectId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("UUID");
    }
  });

  it("rejects a URL without http/https scheme", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      url: "ftp://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a plainly malformed URL", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      url: "not a url at all",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty viewports array", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      viewports: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid viewport name", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      viewports: ["ultrawide"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 viewports", () => {
    const result = CreateRunSchema.safeParse({
      ...validBase,
      viewports: ["desktop", "tablet", "mobile", "desktop"],
    });
    expect(result.success).toBe(false);
  });
});

// ─── AuditJobSchema ─────────────────────────────────────────────────────────

describe("AuditJobSchema", () => {
  const validJob = {
    runId: "550e8400-e29b-41d4-a716-446655440010",
    projectId: "550e8400-e29b-41d4-a716-446655440011",
    url: "https://example.com",
    viewports: ["desktop"],
  };

  it("accepts a valid worker job payload", () => {
    expect(AuditJobSchema.safeParse(validJob).success).toBe(true);
  });

  it("accepts an optional figmaFrameUrl", () => {
    expect(
      AuditJobSchema.safeParse({
        ...validJob,
        figmaFrameUrl: "https://www.figma.com/file/abc123/Frame",
      }).success
    ).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(
      AuditJobSchema.safeParse({
        runId: "bad",
        projectId: "bad",
        url: "not-a-url",
        viewports: [],
      }).success
    ).toBe(false);
  });
});

// ─── FindingSeveritySchema ────────────────────────────────────────────────────

describe("FindingSeveritySchema", () => {
  const validSeverities = ["critical", "high", "medium", "low", "info"] as const;

  it.each(validSeverities)("accepts severity '%s'", (severity) => {
    expect(FindingSeveritySchema.safeParse(severity).success).toBe(true);
  });

  it("rejects an unknown severity", () => {
    expect(FindingSeveritySchema.safeParse("warning").success).toBe(false);
  });
});

// ─── FindingSchema ────────────────────────────────────────────────────────────

describe("FindingSchema", () => {
  const validFinding = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    viewportRunId: "550e8400-e29b-41d4-a716-446655440001",
    ruleId: "overflow-detection",
    findingType: "overflow",
    title: "Content overflow detected",
    description: "The element scrollWidth exceeds its clientWidth by 40px.",
    severity: "high",
    confidence: 0.95,
    evidence: [
      {
        domSelector: ".header nav",
        computedValue: "scrollWidth: 480px",
        expectedValue: "clientWidth: 440px",
      },
    ],
    isIgnored: false,
    createdAt: new Date().toISOString(),
  };

  it("accepts a valid finding object", () => {
    const result = FindingSchema.safeParse(validFinding);
    expect(result.success).toBe(true);
  });

  it("accepts a finding with screenshotRegion evidence", () => {
    const result = FindingSchema.safeParse({
      ...validFinding,
      evidence: [
        {
          screenshotRegion: { x: 10, y: 20, width: 100, height: 50 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence out of range (>1)", () => {
    const result = FindingSchema.safeParse({ ...validFinding, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects confidence out of range (<0)", () => {
    const result = FindingSchema.safeParse({ ...validFinding, confidence: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID id", () => {
    const result = FindingSchema.safeParse({ ...validFinding, id: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("coerces a date string to a Date object", () => {
    const result = FindingSchema.safeParse(validFinding);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });

  it("rejects an invalid findingType", () => {
    const result = FindingSchema.safeParse({
      ...validFinding,
      findingType: "unknown-type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative screenshotRegion width", () => {
    const result = FindingSchema.safeParse({
      ...validFinding,
      evidence: [{ screenshotRegion: { x: 0, y: 0, width: -10, height: 50 } }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── CreateIgnoreRuleSchema ───────────────────────────────────────────────────

describe("CreateIgnoreRuleSchema", () => {
  it("accepts a ruleId-only ignore rule", () => {
    const result = CreateIgnoreRuleSchema.safeParse({ ruleId: "overflow-detection" });
    expect(result.success).toBe(true);
  });

  it("accepts a selector-only ignore rule", () => {
    const result = CreateIgnoreRuleSchema.safeParse({ selector: ".modal-overlay" });
    expect(result.success).toBe(true);
  });

  it("accepts a region-only ignore rule", () => {
    const result = CreateIgnoreRuleSchema.safeParse({
      region: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully specified ignore rule", () => {
    const result = CreateIgnoreRuleSchema.safeParse({
      ruleId: "contrast-warning",
      selector: ".footer a",
      reason: "Brand color exception approved by design team",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty ignore rule (no fields set)", () => {
    const result = CreateIgnoreRuleSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a reason longer than 500 characters", () => {
    const result = CreateIgnoreRuleSchema.safeParse({
      ruleId: "overflow",
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a region with negative width", () => {
    const result = CreateIgnoreRuleSchema.safeParse({
      region: { x: 0, y: 0, width: -1, height: 100 },
    });
    expect(result.success).toBe(false);
  });
});

// ─── ViewportPresetSchema ─────────────────────────────────────────────────────

describe("ViewportPresetSchema", () => {
  it("accepts 'desktop'", () => {
    expect(ViewportPresetSchema.safeParse("desktop").success).toBe(true);
  });

  it("accepts 'tablet'", () => {
    expect(ViewportPresetSchema.safeParse("tablet").success).toBe(true);
  });

  it("accepts 'mobile'", () => {
    expect(ViewportPresetSchema.safeParse("mobile").success).toBe(true);
  });

  it("rejects an unknown preset", () => {
    expect(ViewportPresetSchema.safeParse("4k").success).toBe(false);
  });
});

// ─── ViewportDimensionsSchema ─────────────────────────────────────────────────

describe("ViewportDimensionsSchema", () => {
  it("accepts valid desktop dimensions", () => {
    expect(
      ViewportDimensionsSchema.safeParse({ width: 1440, height: 900 }).success
    ).toBe(true);
  });

  it("rejects zero width", () => {
    expect(
      ViewportDimensionsSchema.safeParse({ width: 0, height: 900 }).success
    ).toBe(false);
  });

  it("rejects dimensions exceeding max 7680×4320", () => {
    expect(
      ViewportDimensionsSchema.safeParse({ width: 8000, height: 900 }).success
    ).toBe(false);
  });

  it("rejects non-integer dimensions", () => {
    expect(
      ViewportDimensionsSchema.safeParse({ width: 1440.5, height: 900 }).success
    ).toBe(false);
  });
});

// ─── ExportFormatSchema ───────────────────────────────────────────────────────

describe("ExportFormatSchema", () => {
  it("accepts 'json'", () => {
    expect(ExportFormatSchema.safeParse("json").success).toBe(true);
  });

  it("accepts 'markdown'", () => {
    expect(ExportFormatSchema.safeParse("markdown").success).toBe(true);
  });

  it("rejects 'csv'", () => {
    expect(ExportFormatSchema.safeParse("csv").success).toBe(false);
  });
});

// ─── VIEWPORT_PRESETS constant ────────────────────────────────────────────────

describe("VIEWPORT_PRESETS", () => {
  it("desktop preset has correct dimensions", () => {
    expect(VIEWPORT_PRESETS.desktop).toEqual({ width: 1440, height: 900 });
  });

  it("tablet preset has correct dimensions", () => {
    expect(VIEWPORT_PRESETS.tablet).toEqual({ width: 768, height: 1024 });
  });

  it("mobile preset has correct dimensions", () => {
    expect(VIEWPORT_PRESETS.mobile).toEqual({ width: 390, height: 844 });
  });
});

// ─── parseOrThrow helper ──────────────────────────────────────────────────────

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    const data = parseOrThrow(FindingSeveritySchema, "high");
    expect(data).toBe("high");
  });

  it("throws a ZodError on invalid data", () => {
    expect(() => parseOrThrow(FindingSeveritySchema, "extreme")).toThrow();
  });
});

// ─── safeParse helper ─────────────────────────────────────────────────────────

describe("safeParse", () => {
  it("returns success:true with data on valid input", () => {
    const result = safeParse(FindingSeveritySchema, "medium");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("medium");
    }
  });

  it("returns success:false with error on invalid input", () => {
    const result = safeParse(FindingSeveritySchema, 42);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
