-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LinkLifecycleState" AS ENUM ('active', 'soft_inactive', 'superseded');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "displayName" TEXT NOT NULL DEFAULT '',
    "defaultProductScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettingsRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettingsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSessionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemAnalysisBatch" (
    "storageKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemAnalysisBatch_pkey" PRIMARY KEY ("storageKey")
);

-- CreateTable
CREATE TABLE "MemRefreshJob" (
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemRefreshJob_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "MemSyncedAccounts" (
    "userId" TEXT NOT NULL,
    "accountsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemSyncedAccounts_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WorkbenchOwner" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productOwnerId" TEXT NOT NULL DEFAULT '',
    "mediaOwnerId" TEXT NOT NULL DEFAULT '',
    "creativeOwnerId" TEXT NOT NULL DEFAULT '',
    "taskStatus" TEXT NOT NULL DEFAULT 'unassigned',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbenchOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbenchTask" (
    "id" TEXT NOT NULL,
    "productName" TEXT,
    "creativeId" TEXT,
    "draftId" TEXT,
    "reviewSessionId" TEXT,
    "title" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unassigned',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "taskSource" TEXT,
    "priority" TEXT,
    "dueDate" TIMESTAMP(3),
    "impactAmount" TEXT,
    "taskType" TEXT,

    CONSTRAINT "WorkbenchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbenchAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkbenchAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbenchMapping" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbenchMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThresholdVersion" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "productId" TEXT,
    "config" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThresholdVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "structuredOverlay" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL,
    "dryRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" TEXT,
    "previewJson" TEXT,
    "resultJson" TEXT,
    "errorJson" TEXT,
    "rollbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishDraftRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchId" TEXT,
    "accountId" TEXT NOT NULL,
    "pageId" TEXT,
    "igAccountId" TEXT,
    "campaignObjective" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adSetName" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "budgetDaily" DOUBLE PRECISION,
    "budgetTotal" DOUBLE PRECISION,
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
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastExecutionStatus" TEXT,
    "lastExecutionAt" TIMESTAMP(3),
    "lastExecutionSummary" TEXT,
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "metaAdId" TEXT,
    "metaCreativeId" TEXT,

    CONSTRAINT "PublishDraftRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishLogRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishLogRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeReviewRecord" (
    "id" TEXT NOT NULL,
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
    "score" DOUBLE PRECISION,
    "reasonsJson" TEXT,
    "suggestionsJson" TEXT,
    "evidenceJson" TEXT,
    "blockingJson" TEXT,
    "pendingJson" TEXT,
    "rawResultJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeReviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativePatternTag" (
    "id" TEXT NOT NULL,
    "creativeReviewId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "tagValue" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativePatternTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeExperimentLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "publishDraftId" TEXT,
    "campaignId" TEXT,
    "adSetId" TEXT,
    "adId" TEXT,
    "creativeId" TEXT,
    "productName" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "attributionMode" TEXT,
    "linkLifecycleState" "LinkLifecycleState" NOT NULL DEFAULT 'active',

    CONSTRAINT "CreativeExperimentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeOutcomeSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "campaignId" TEXT,
    "productName" TEXT,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "addToCart" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT,
    "lifecycleLabel" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "evidenceJson" TEXT,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ambiguousAttribution" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CreativeOutcomeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeReviewJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "reviewSource" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "requestedBy" TEXT,
    "mode" TEXT,
    "mediaKind" TEXT,

    CONSTRAINT "CreativeReviewJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbenchAdjustDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "adjustCount" INTEGER NOT NULL DEFAULT 0,
    "lastAdjustAt" TIMESTAMP(3),
    "lastAdjustType" TEXT,
    "observationWindowUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbenchAdjustDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCampaignBudgetSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dailyBudgetMinor" INTEGER,
    "effectiveStatus" TEXT,
    "metaUpdatedAt" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaCampaignBudgetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettingsRecord_userId_key" ON "UserSettingsRecord"("userId");

-- CreateIndex
CREATE INDEX "ReviewSessionRecord_userId_createdAt_idx" ON "ReviewSessionRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemAnalysisBatch_userId_idx" ON "MemAnalysisBatch"("userId");

-- CreateIndex
CREATE INDEX "MemRefreshJob_userId_idx" ON "MemRefreshJob"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbenchOwner_productName_key" ON "WorkbenchOwner"("productName");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbenchMapping_entityType_entityId_key" ON "WorkbenchMapping"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRun_dryRunId_key" ON "ExecutionRun"("dryRunId");

-- CreateIndex
CREATE INDEX "ExecutionRun_userId_createdAt_idx" ON "ExecutionRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionRun_actionType_createdAt_idx" ON "ExecutionRun"("actionType", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionRun_status_createdAt_idx" ON "ExecutionRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PublishDraftRecord_userId_createdAt_idx" ON "PublishDraftRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishDraftRecord_batchId_idx" ON "PublishDraftRecord"("batchId");

-- CreateIndex
CREATE INDEX "PublishLogRecord_userId_createdAt_idx" ON "PublishLogRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishLogRecord_draftId_createdAt_idx" ON "PublishLogRecord"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeReviewRecord_userId_createdAt_idx" ON "CreativeReviewRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeReviewRecord_assetVersionId_createdAt_idx" ON "CreativeReviewRecord"("assetVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativePatternTag_creativeReviewId_idx" ON "CreativePatternTag"("creativeReviewId");

-- CreateIndex
CREATE INDEX "CreativePatternTag_tagType_tagValue_idx" ON "CreativePatternTag"("tagType", "tagValue");

-- CreateIndex
CREATE INDEX "CreativeExperimentLink_assetVersionId_idx" ON "CreativeExperimentLink"("assetVersionId");

-- CreateIndex
CREATE INDEX "CreativeExperimentLink_campaignId_idx" ON "CreativeExperimentLink"("campaignId");

-- CreateIndex
CREATE INDEX "CreativeExperimentLink_adId_idx" ON "CreativeExperimentLink"("adId");

-- CreateIndex
CREATE INDEX "CreativeExperimentLink_userId_publishDraftId_idx" ON "CreativeExperimentLink"("userId", "publishDraftId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeExperimentLink_userId_publishDraftId_assetVersionId_key" ON "CreativeExperimentLink"("userId", "publishDraftId", "assetVersionId");

-- CreateIndex
CREATE INDEX "CreativeOutcomeSnapshot_assetVersionId_snapshotDate_idx" ON "CreativeOutcomeSnapshot"("assetVersionId", "snapshotDate");

-- CreateIndex
CREATE INDEX "CreativeOutcomeSnapshot_campaignId_snapshotDate_idx" ON "CreativeOutcomeSnapshot"("campaignId", "snapshotDate");

-- CreateIndex
CREATE INDEX "CreativeReviewJob_userId_status_createdAt_idx" ON "CreativeReviewJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeReviewJob_userId_createdAt_idx" ON "CreativeReviewJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkbenchAdjustDaily_userId_dateKey_idx" ON "WorkbenchAdjustDaily"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbenchAdjustDaily_userId_entityKey_dateKey_key" ON "WorkbenchAdjustDaily"("userId", "entityKey", "dateKey");

-- CreateIndex
CREATE INDEX "MetaCampaignBudgetSnapshot_userId_idx" ON "MetaCampaignBudgetSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCampaignBudgetSnapshot_userId_campaignId_key" ON "MetaCampaignBudgetSnapshot"("userId", "campaignId");
