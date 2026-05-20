// Types
export type {
  FindingSeverity,
  AuditRunStatus,
  ViewportRunStatus,
  FigmaReferenceStatus,
  ViewportPreset,
  ViewportDimensions,
  Project,
  AuditRun,
  ViewportRun,
  ArtifactType,
  CaptureArtifact,
  FindingType,
  FindingEvidence,
  Finding,
  FigmaReference,
  IgnoreRule,
} from "./types.js";

export { VIEWPORT_PRESETS } from "./types.js";

// Schemas
export {
  ViewportPresetSchema,
  ViewportDimensionsSchema,
  CreateProjectSchema,
  CreateRunSchema,
  AuditJobSchema,
  FindingSeveritySchema,
  FindingEvidenceSchema,
  FindingSchema,
  CreateIgnoreRuleSchema,
  ExportFormatSchema,
  parseOrThrow,
  safeParse,
} from "./schemas.js";

export type {
  CreateProjectRequest,
  CreateRunRequest,
  AuditJobRequest,
  FindingSchemaType,
  CreateIgnoreRuleRequest,
  ExportFormat,
} from "./schemas.js";
