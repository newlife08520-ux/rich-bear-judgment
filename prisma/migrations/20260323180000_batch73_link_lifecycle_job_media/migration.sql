-- Batch 7.3: link lifecycle state; Batch 7.4: job media kind
ALTER TABLE "CreativeExperimentLink" ADD COLUMN "linkLifecycleState" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "CreativeReviewJob" ADD COLUMN "mediaKind" TEXT;
