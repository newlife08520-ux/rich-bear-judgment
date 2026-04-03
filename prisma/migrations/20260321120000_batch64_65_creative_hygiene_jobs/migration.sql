-- Batch 6.4–6.5: dedupe experiment links, unique index, outcome ambiguity, review jobs

-- Remove duplicate CreativeExperimentLink (keep earliest rowid)
DELETE FROM "CreativeExperimentLink"
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM "CreativeExperimentLink"
  GROUP BY "userId", IFNULL("publishDraftId", ''), "assetVersionId"
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreativeExperimentLink_userId_publishDraftId_assetVersionId_key"
ON "CreativeExperimentLink"("userId", "publishDraftId", "assetVersionId");

ALTER TABLE "CreativeOutcomeSnapshot" ADD COLUMN "ambiguousAttribution" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CreativeReviewJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "reviewSource" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CreativeReviewJob_userId_status_createdAt_idx" ON "CreativeReviewJob"("userId", "status", "createdAt");
CREATE INDEX "CreativeReviewJob_userId_createdAt_idx" ON "CreativeReviewJob"("userId", "createdAt");
