import { z } from "zod";
import { type ViewportPreset } from "./types.js";

// ─── Viewport schema ──────────────────────────────────────────────────────────

export const ViewportPresetSchema = z.enum(["desktop", "tablet", "mobile"]);

export const ViewportDimensionsSchema = z.object({
  width: z.number().int().positive().max(7680),
  height: z.number().int().positive().max(4320),
});

// ─── URL validation ───────────────────────────────────────────────────────────

const HttpUrlSchema = z
  .string()
  .url()
  .refine(
    (val) => val.startsWith("http://") || val.startsWith("https://"),
    "URL must use http or https protocol"
  );

// ─── Create project ───────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;

// ─── Create run ───────────────────────────────────────────────────────────────

export const CreateRunSchema = z.object({
  projectId: z.string().uuid("projectId must be a valid UUID"),
  url: HttpUrlSchema,
  viewports: z
    .array(ViewportPresetSchema)
    .min(1, "At least one viewport must be selected")
    .max(3),
  figmaFrameUrl: z.string().url().optional().nullable(),
});

export type CreateRunRequest = z.infer<typeof CreateRunSchema>;

// ─── Worker job schema ───────────────────────────────────────────────────────

export const AuditJobSchema = z.object({
  runId: z.string().uuid(),
  projectId: z.string().uuid(),
  url: HttpUrlSchema,
  viewports: z.array(ViewportPresetSchema).min(1).max(3),
  figmaFrameUrl: z.string().url().optional().nullable(),
});

export type AuditJobRequest = z.infer<typeof AuditJobSchema>;

// ─── Finding schema ───────────────────────────────────────────────────────────

export const FindingSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const FindingEvidenceSchema = z.object({
  screenshotRegion: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  domSelector: z.string().optional(),
  computedValue: z.string().optional(),
  expectedValue: z.string().optional(),
  additionalData: z.record(z.unknown()).optional(),
});

export const FindingSchema = z.object({
  id: z.string().uuid(),
  viewportRunId: z.string().uuid(),
  ruleId: z.string().min(1),
  findingType: z.enum([
    "overflow",
    "overlap",
    "alignment-drift",
    "spacing-inconsistency",
    "typography-inconsistency",
    "color-mismatch",
    "contrast-warning",
    "figma-comparison",
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: FindingSeveritySchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(FindingEvidenceSchema),
  isIgnored: z.boolean(),
  createdAt: z.coerce.date(),
});

export type FindingSchemaType = z.infer<typeof FindingSchema>;

// ─── Ignore rule ──────────────────────────────────────────────────────────────

export const CreateIgnoreRuleSchema = z
  .object({
    ruleId: z.string().optional(),
    selector: z.string().optional(),
    region: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (data) => data.ruleId !== undefined || data.selector !== undefined || data.region !== undefined,
    "At least one of ruleId, selector, or region must be provided"
  );

export type CreateIgnoreRuleRequest = z.infer<typeof CreateIgnoreRuleSchema>;

// ─── Export / report ──────────────────────────────────────────────────────────

export const ExportFormatSchema = z.enum(["json", "markdown"]);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Type-safe parse helper. Returns the parsed value or throws a ZodError.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Type-safe safe-parse helper. Returns { success, data } or { success: false, error }.
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown
): z.SafeParseReturnType<unknown, T> {
  return schema.safeParse(data);
}
