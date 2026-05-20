// ─── Severity ─────────────────────────────────────────────────────────────────

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

// ─── Statuses ─────────────────────────────────────────────────────────────────

export type AuditRunStatus =
  | "queued"
  | "capturing"
  | "captured"
  | "running_rules"
  | "rules_complete"
  | "comparing"
  | "complete"
  | "failed";

export type ViewportRunStatus =
  | "queued"
  | "capturing"
  | "captured"
  | "running_rules"
  | "rules_complete"
  | "comparing"
  | "complete"
  | "failed";

export type FigmaReferenceStatus = "pending" | "fetching" | "ready" | "failed";

// ─── Viewport ─────────────────────────────────────────────────────────────────

export type ViewportPreset = "desktop" | "tablet" | "mobile";

export interface ViewportDimensions {
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS: Record<ViewportPreset, ViewportDimensions> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── AuditRun ─────────────────────────────────────────────────────────────────

export interface AuditRun {
  id: string;
  projectId: string;
  url: string;
  status: AuditRunStatus;
  figmaFrameUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  viewportRuns: ViewportRun[];
}

// ─── ViewportRun ──────────────────────────────────────────────────────────────

export interface ViewportRun {
  id: string;
  auditRunId: string;
  viewport: ViewportPreset;
  viewportWidth: number;
  viewportHeight: number;
  status: ViewportRunStatus;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── CaptureArtifact ──────────────────────────────────────────────────────────

export type ArtifactType =
  | "screenshot"
  | "figma_frame"
  | "pixel_diff"
  | "dom_snapshot";

export interface CaptureArtifact {
  id: string;
  viewportRunId: string;
  artifactType: ArtifactType;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  capturedAt: Date;
}

// ─── Finding ──────────────────────────────────────────────────────────────────

export type FindingType =
  | "overflow"
  | "overlap"
  | "alignment-drift"
  | "spacing-inconsistency"
  | "typography-inconsistency"
  | "color-mismatch"
  | "contrast-warning"
  | "figma-comparison";

export interface FindingEvidence {
  screenshotRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  domSelector?: string;
  computedValue?: string;
  expectedValue?: string;
  additionalData?: Record<string, unknown>;
}

export interface Finding {
  id: string;
  viewportRunId: string;
  ruleId: string;
  findingType: FindingType;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
  evidence: FindingEvidence[];
  isIgnored: boolean;
  createdAt: Date;
}

// ─── FigmaReference ───────────────────────────────────────────────────────────

export interface FigmaReference {
  id: string;
  viewportRunId: string;
  fileKey: string;
  nodeId: string;
  frameImageKey: string | null;
  metadataKey: string | null;
  status: FigmaReferenceStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── IgnoreRule ───────────────────────────────────────────────────────────────

export interface IgnoreRule {
  id: string;
  auditRunId: string;
  ruleId: string | null;
  selector: string | null;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  reason: string | null;
  createdAt: Date;
}
