-- Creative Intelligence + Goal/Pacing ledger
CREATE TABLE "CreativeReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "assetPackageId" TEXT,
    "productName" TEXT,
    "reviewSource" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "uiMode" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "summary" TEXT,
    "nextAction" TEXT,
    "problemType" TEXT,
    "confidence" TEXT,
    "score" REAL,
    "reasonsJson" TEXT,
    "suggestionsJson" TEXT,
    "evidenceJson" TEXT,
    "blockingJson" TEXT,
    "pendingJson" TEXT,
    "rawResultJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "CreativeReviewRecord_userId_createdAt_idx" ON "CreativeReviewRecord"("userId", "createdAt");
CREATE INDEX "CreativeReviewRecord_assetVersionId_createdAt_idx" ON "CreativeReviewRecord"("assetVersionId", "createdAt");

CREATE TABLE "CreativePatternTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creativeReviewId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "tagValue" TEXT NOT NULL,
    "weight" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CreativePatternTag_creativeReviewId_idx" ON "CreativePatternTag"("creativeReviewId");
CREATE INDEX "CreativePatternTag_tagType_tagValue_idx" ON "CreativePatternTag"("tagType", "tagValue");

CREATE TABLE "CreativeExperimentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "publishDraftId" TEXT,
    "campaignId" TEXT,
    "adSetId" TEXT,
    "adId" TEXT,
    "creativeId" TEXT,
    "productName" TEXT,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CreativeExperimentLink_assetVersionId_idx" ON "CreativeExperimentLink"("assetVersionId");
CREATE INDEX "CreativeExperimentLink_campaignId_idx" ON "CreativeExperimentLink"("campaignId");
CREATE INDEX "CreativeExperimentLink_adId_idx" ON "CreativeExperimentLink"("adId");
CREATE INDEX "CreativeExperimentLink_userId_publishDraftId_idx" ON "CreativeExperimentLink"("userId", "publishDraftId");

CREATE TABLE "CreativeOutcomeSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "campaignId" TEXT,
    "productName" TEXT,
    "spend" REAL NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "roas" REAL NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "addToCart" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT,
    "lifecycleLabel" TEXT,
    "qualityScore" REAL,
    "evidenceJson" TEXT,
    "snapshotDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CreativeOutcomeSnapshot_assetVersionId_snapshotDate_idx" ON "CreativeOutcomeSnapshot"("assetVersionId", "snapshotDate");
CREATE INDEX "CreativeOutcomeSnapshot_campaignId_snapshotDate_idx" ON "CreativeOutcomeSnapshot"("campaignId", "snapshotDate");

CREATE TABLE "WorkbenchAdjustDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "adjustCount" INTEGER NOT NULL DEFAULT 0,
    "lastAdjustAt" DATETIME,
    "lastAdjustType" TEXT,
    "observationWindowUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "WorkbenchAdjustDaily_userId_entityKey_dateKey_key" ON "WorkbenchAdjustDaily"("userId", "entityKey", "dateKey");
CREATE INDEX "WorkbenchAdjustDaily_userId_dateKey_idx" ON "WorkbenchAdjustDaily"("userId", "dateKey");
