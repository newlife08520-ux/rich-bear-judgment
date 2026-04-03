-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dryRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" TEXT,
    "previewJson" TEXT,
    "resultJson" TEXT,
    "errorJson" TEXT,
    "rollbackNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "appliedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRun_dryRunId_key" ON "ExecutionRun"("dryRunId");

-- CreateIndex
CREATE INDEX "ExecutionRun_userId_createdAt_idx" ON "ExecutionRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionRun_actionType_createdAt_idx" ON "ExecutionRun"("actionType", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionRun_status_createdAt_idx" ON "ExecutionRun"("status", "createdAt");
