-- AlterTable
ALTER TABLE "PublishDraftRecord" ADD COLUMN "lastExecutionStatus" TEXT;
ALTER TABLE "PublishDraftRecord" ADD COLUMN "lastExecutionAt" DATETIME;
ALTER TABLE "PublishDraftRecord" ADD COLUMN "lastExecutionSummary" TEXT;
ALTER TABLE "PublishDraftRecord" ADD COLUMN "metaCampaignId" TEXT;
ALTER TABLE "PublishDraftRecord" ADD COLUMN "metaAdSetId" TEXT;
ALTER TABLE "PublishDraftRecord" ADD COLUMN "metaAdId" TEXT;
ALTER TABLE "PublishDraftRecord" ADD COLUMN "metaCreativeId" TEXT;
