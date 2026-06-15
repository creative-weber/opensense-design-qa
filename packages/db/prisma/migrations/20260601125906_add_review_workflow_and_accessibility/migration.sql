-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('open', 'acknowledged', 'ignored', 'resolved');

-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "review_status" "review_status" NOT NULL DEFAULT 'open',
ADD COLUMN     "reviewed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "findings_review_status_idx" ON "findings"("review_status");
