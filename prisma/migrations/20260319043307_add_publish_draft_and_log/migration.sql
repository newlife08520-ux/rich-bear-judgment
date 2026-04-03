-- CreateTable
CREATE TABLE "PublishDraftRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "batchId" TEXT,
    "accountId" TEXT NOT NULL,
    "pageId" TEXT,
    "igAccountId" TEXT,
    "campaignObjective" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adSetName" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "budgetDaily" REAL,
    "budgetTotal" REAL,
    "scheduleStart" TEXT,
    "scheduleEnd" TEXT,
    "audienceStrategy" TEXT NOT NULL,
    "placementStrategy" TEXT NOT NULL,
    "assetPackageId" TEXT,
    "selectedVersionIdsJson" TEXT,
    "assetIdsJson" TEXT,
    "primaryCopy" TEXT,
    "headline" TEXT,
    "note" TEXT,
    "cta" TEXT,
    "landingPageUrl" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublishLogRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "draftId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PublishDraftRecord_userId_createdAt_idx" ON "PublishDraftRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishDraftRecord_batchId_idx" ON "PublishDraftRecord"("batchId");

-- CreateIndex
CREATE INDEX "PublishLogRecord_userId_createdAt_idx" ON "PublishLogRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishLogRecord_draftId_createdAt_idx" ON "PublishLogRecord"("draftId", "createdAt");
