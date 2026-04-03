# Phase 3 驗收報告

## 完成項目

### 1. 有限併發與 Retry

- **`server/lib/concurrency.ts`**：`mapWithConcurrency(items, limit, worker)`、`DEFAULT_REFRESH_FETCH_CONCURRENCY = 5`。
- **`server/lib/retry.ts`**：`isRetryableError(err)`、`withExponentialBackoff(fn, opts)`（429、5xx、ECONNRESET 等可重試）。
- **`server/refresh-pipeline.ts`**：Meta、GA4、多時間窗口、GA4 頁面擷取改為 `mapWithConcurrency(..., REFRESH_FETCH_CONCURRENCY, ...)`，併發數由 env `REFRESH_FETCH_CONCURRENCY` 或預設 5 讀取。

### 2. Multer 改 Disk

- **`server/lib/upload-temp.ts`**：`createDiskStorage(opts)`、`cleanupUploadTempFile(path)`；temp 目錄可配置、MIME 前綴白名單。
- **`server/routes.ts`**：content judgment 上傳使用 `createDiskStorage`，成功/失敗皆在 `finally` 呼叫 `cleanupUploadTempFile`。
- **`server/modules/asset/asset-package-routes.ts`**：同上，使用 disk storage 與 cleanup。

### 3. Workbench Batch 批次寫入

- **`server/workbench-db.ts`**：`createWorkbenchTasksBatch(inputs)`，單一 `$transaction` 內依序 `create` + `workbenchAudit.create`，避免 N+1。
- **`server/routes.ts`**：`POST /api/workbench/tasks/batch` 與 Lucky 任務建立皆改為呼叫 `createWorkbenchTasksBatch`。

## 驗收腳本與實際執行

| 腳本 | 說明 |
|------|------|
| `script/verify-phase3-concurrency.ts` | mapWithConcurrency 順序與併發上限、isRetryableError、withExponentialBackoff 基本行為 |
| `script/verify-phase3-no-memory-storage.ts` | server 下無 memoryStorage()，上傳使用 createDiskStorage + cleanup |
| `script/verify-phase3-upload-cleanup.ts` | content-judgment 與 asset-package 成功/失敗路徑皆 cleanup temp |
| `script/verify-phase3-workbench-bulk.ts` | batch 路徑使用 createWorkbenchTasksBatch，無 N+1 逐筆 create |

- **`npm run verify:phase3`**：依序執行以上四支，fail-fast。

## 本階段未完成（不可宣稱 Phase 3 完整完成）

- **Retry 套到外部 fetch**：`withExponentialBackoff` 尚未包在 refresh-pipeline / Meta / GA4 fetch 外層。
- **Event loop 讓步**：repo 中無 setImmediate 或讓出 event loop 的實作，長迴圈處尚未加上。

## 風險與後續

- 併發數 5 為預設，大量帳號時可調高 `REFRESH_FETCH_CONCURRENCY` 或監控記憶體。
- 若未來在 pipeline 外層加上 retry，建議補 `verify-phase3-retry` 模擬失敗重試次數。
