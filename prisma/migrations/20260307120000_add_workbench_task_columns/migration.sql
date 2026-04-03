-- AlterTable: WorkbenchTask 補齊 schema 新增欄位（draftId, reviewSessionId, taskSource, priority, dueDate, impactAmount, taskType）
-- SQLite 若欄位已存在會報錯，可忽略或改為 IF NOT EXISTS（Prisma 不支援，需手動處理已存在情境）

ALTER TABLE "WorkbenchTask" ADD COLUMN "draftId" TEXT;
ALTER TABLE "WorkbenchTask" ADD COLUMN "reviewSessionId" TEXT;
ALTER TABLE "WorkbenchTask" ADD COLUMN "taskSource" TEXT;
ALTER TABLE "WorkbenchTask" ADD COLUMN "priority" TEXT;
ALTER TABLE "WorkbenchTask" ADD COLUMN "dueDate" DATETIME;
ALTER TABLE "WorkbenchTask" ADD COLUMN "impactAmount" TEXT;
ALTER TABLE "WorkbenchTask" ADD COLUMN "taskType" TEXT;
