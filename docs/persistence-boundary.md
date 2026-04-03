# 持久化邊界與資料存放

依 cursor_acceptance_gap_closure Step 6。本文件為持久化邊界與 batch metadata 之唯一說明。

## 邊界總覽

| 存放位置 | 用途 | 檔案／來源 |
|----------|------|------------|
| **.data/**（伺服器磁碟） | 設定、批次、工作、工作台、上傳 | 見下表 |
| **Prisma / 資料庫** | Prompt 版本、門檻版本、產品負責人、任務、稽核、對應表 | schema.prisma |
| **client localStorage** | 前端 scope（帳號/屬性/日期）、per-user key：`app-scope:${userId}` | 僅前端 |

## .data 目錄結構（server/storage.ts）

| 檔案 | 內容 | 備註 |
|------|------|------|
| settings.json | 使用者設定（userId → UserSettings） | 含驗證狀態、API key 指紋等 |
| synced-accounts.json | 已同步帳號集合 | 依 userId |
| favorites.json | 收藏帳號 | 依 userId |
| **latest-batch.json** | 分析批次（key = scopeKey 或 userId） | 見 Batch metadata |
| review-sessions.json | 審判對話 session | 依 userId |
| workbench-owners.json | 商品負責人 | WorkbenchProductOwners |
| workbench-tasks.json | 工作台任務列表 | WorkbenchTask[] |
| workbench-audit.json | 工作台稽核紀錄 | WorkbenchAuditEntry[] |
| workbench-mapping.json | 活動→商品對應覆寫 | Record<string, string> |
| refresh-jobs.json | Refresh job 狀態（jobId → RefreshJob） | 重啟時 running → failed |

上傳檔案（local provider）：`.data/uploads/{userId}/{filename}`。

## Batch metadata

- **Key 格式**：`buildScopeKey(userId, accountIds, propertyIds, datePreset[, customStart, customEnd])` → `userId::scope::datePart`（preset 為 custom 時 datePart = `custom:start~end`）。
- **寫入**：僅在 refresh pipeline **全成功**後由 refresh-job-runner 呼叫 `storage.saveBatch(userId, batch)`；絕不提前把 candidate 寫成 latest（見 refresh-job-runner、refresh-pipeline）。
- **讀取**：`getLatestBatch(userId, scopeKey?)`；無 scopeKey 時以 userId 為 key 取 fallback（同一 userId 多筆時選有 precomputed 且 precomputeCompletedAt/generatedAt 較新者，見 precompute-path-verification.md）。
- **持久化**：saveBatch 時將整個 batchStore 寫入 `.data/latest-batch.json`；單一 userId 最多保留 10 個 scopeKey，逾量刪最舊。

## 信任邊界

- 設定內敏感欄位（如 API key）僅存指紋或 hash，不存明文於 .data；實際 key 存於 memory，重啟後需重新設定或由環境變數注入。
- Batch 與 refresh job 為伺服器權威；前端不得改寫。
