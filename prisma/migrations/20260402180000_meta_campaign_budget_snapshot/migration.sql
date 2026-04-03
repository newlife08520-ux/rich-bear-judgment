-- CreateTable
CREATE TABLE "MetaCampaignBudgetSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dailyBudgetMinor" INTEGER,
    "effectiveStatus" TEXT,
    "metaUpdatedAt" TEXT,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "MetaCampaignBudgetSnapshot_userId_campaignId_key" ON "MetaCampaignBudgetSnapshot"("userId", "campaignId");
CREATE INDEX "MetaCampaignBudgetSnapshot_userId_idx" ON "MetaCampaignBudgetSnapshot"("userId");
