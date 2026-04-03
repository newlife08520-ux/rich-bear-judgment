# Execution 稽核表面

## 全域頁

- 路由：`/execution-history`（`ExecutionHistoryPage`）。
- 資料：`GET /api/execution/logs?limit=200`（Prisma `ExecutionRun` 展開 dry-run / apply / failed / rollback 備註）。
- **v2 表面**：類型／狀態篩選、關鍵字（action、dryRunId、摘要、錯誤）；表格欄含**操作者**（`userId` 縮寫）、**目標／受影響**（`affectedIds` 或 `resultMeta.rollbackSnapshot`）、**變更快照**（可讀 rollback 摘要，完整內容見儲存格 `title`）。共用邏輯：`client/src/lib/execution-log-display.ts`。

## 入口

- 側欄次導航「執行稽核」。
- 首頁／商品／預算／投放中心之連結（`data-testid` 見各頁）。

## 與對話框紀錄之差異

- 對話框適合**當前工作脈絡**快速檢視；全域頁適合**企業稽核與跨日追蹤**。

## Reviewer

- 確認 ZIP 內含 Prisma schema 之 `ExecutionRun` 與本頁表格欄位對照。
