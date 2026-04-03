-- Batch 6.4 packaging: soft-deactivate experiment links (audit trail) + primary flag
ALTER TABLE "CreativeExperimentLink" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreativeExperimentLink" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CreativeExperimentLink" ADD COLUMN "removedAt" DATETIME;
ALTER TABLE "CreativeExperimentLink" ADD COLUMN "attributionMode" TEXT;

-- Batch 6.5 packaging: review job observability
ALTER TABLE "CreativeReviewJob" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CreativeReviewJob" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "CreativeReviewJob" ADD COLUMN "requestedBy" TEXT;
ALTER TABLE "CreativeReviewJob" ADD COLUMN "mode" TEXT;
