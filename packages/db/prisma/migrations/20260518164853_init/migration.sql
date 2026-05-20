-- CreateEnum
CREATE TYPE "audit_run_status" AS ENUM ('queued', 'capturing', 'captured', 'running_rules', 'rules_complete', 'comparing', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "viewport_preset" AS ENUM ('desktop', 'tablet', 'mobile');

-- CreateEnum
CREATE TYPE "viewport_run_status" AS ENUM ('queued', 'capturing', 'captured', 'running_rules', 'rules_complete', 'comparing', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "artifact_type" AS ENUM ('screenshot', 'diff_image', 'figma_frame');

-- CreateEnum
CREATE TYPE "finding_severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "figma_reference_status" AS ENUM ('pending', 'fetching', 'ready', 'failed');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "audit_run_status" NOT NULL DEFAULT 'queued',
    "figma_frame_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewport_runs" (
    "id" TEXT NOT NULL,
    "audit_run_id" TEXT NOT NULL,
    "viewport" "viewport_preset" NOT NULL,
    "viewport_width" INTEGER NOT NULL,
    "viewport_height" INTEGER NOT NULL,
    "status" "viewport_run_status" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "viewport_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_artifacts" (
    "id" TEXT NOT NULL,
    "viewport_run_id" TEXT NOT NULL,
    "artifact_type" "artifact_type" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/png',
    "size_bytes" INTEGER,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "viewport_run_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "finding_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "finding_severity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_evidence" (
    "id" TEXT NOT NULL,
    "finding_id" TEXT NOT NULL,
    "dom_selector" TEXT,
    "computed_value" TEXT,
    "expected_value" TEXT,
    "screenshot_region_x" DOUBLE PRECISION,
    "screenshot_region_y" DOUBLE PRECISION,
    "screenshot_region_width" DOUBLE PRECISION,
    "screenshot_region_height" DOUBLE PRECISION,
    "additional_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "figma_references" (
    "id" TEXT NOT NULL,
    "audit_run_id" TEXT NOT NULL,
    "figma_file_key" TEXT NOT NULL,
    "figma_node_id" TEXT NOT NULL,
    "storage_key" TEXT,
    "metadata_json" JSONB,
    "status" "figma_reference_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "figma_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ignore_rules" (
    "id" TEXT NOT NULL,
    "audit_run_id" TEXT NOT NULL,
    "selector" TEXT,
    "rule_id" TEXT,
    "region_x" DOUBLE PRECISION,
    "region_y" DOUBLE PRECISION,
    "region_w" DOUBLE PRECISION,
    "region_h" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ignore_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_runs_project_id_idx" ON "audit_runs"("project_id");

-- CreateIndex
CREATE INDEX "audit_runs_status_idx" ON "audit_runs"("status");

-- CreateIndex
CREATE INDEX "audit_runs_created_at_idx" ON "audit_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "viewport_runs_audit_run_id_idx" ON "viewport_runs"("audit_run_id");

-- CreateIndex
CREATE INDEX "viewport_runs_status_idx" ON "viewport_runs"("status");

-- CreateIndex
CREATE INDEX "capture_artifacts_viewport_run_id_idx" ON "capture_artifacts"("viewport_run_id");

-- CreateIndex
CREATE INDEX "findings_viewport_run_id_idx" ON "findings"("viewport_run_id");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "findings_ignored_idx" ON "findings"("ignored");

-- CreateIndex
CREATE INDEX "finding_evidence_finding_id_idx" ON "finding_evidence"("finding_id");

-- CreateIndex
CREATE UNIQUE INDEX "figma_references_audit_run_id_key" ON "figma_references"("audit_run_id");

-- CreateIndex
CREATE INDEX "ignore_rules_audit_run_id_idx" ON "ignore_rules"("audit_run_id");

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewport_runs" ADD CONSTRAINT "viewport_runs_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_artifacts" ADD CONSTRAINT "capture_artifacts_viewport_run_id_fkey" FOREIGN KEY ("viewport_run_id") REFERENCES "viewport_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_viewport_run_id_fkey" FOREIGN KEY ("viewport_run_id") REFERENCES "viewport_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figma_references" ADD CONSTRAINT "figma_references_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignore_rules" ADD CONSTRAINT "ignore_rules_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
