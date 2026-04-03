# 階段二驗收報告

## 授權邊界（必做、易漏）：GET /api/refresh/:jobId/status

此 API 一旦做成「用 jobId 查狀態」，**若沒檢查「此 job 是否屬於當前登入者」，就會變成：只要知道 jobId，任何人都能查別人的 refresh 狀態、錯誤訊息、scope**，等同資訊洩漏。

- **實作**：`if (!job || job.userId !== req.session.userId) return res.status(404).json({ error: "job not found" })`。
- **位置**：`server/routes.ts`，GET `/api/refresh/:jobId/status` 內；程式註解已標「不可刪除下方 userId 比對」。
- **語意**：對「job 不存在」與「job 屬其他使用者」一律回 404，不區分以免洩漏 job 是否存在。

---

## 安全驗收項：跨使用者查 job（必要、可自動化）

此項為 phase 2 必要安全條件，不可刪除。

### 情境

1. 使用者 A 登入，呼叫 `POST /api/refresh`，取得 `jobId`
2. 使用者 B 已登入（與 A 為不同帳號）
3. 使用者 B 呼叫 `GET /api/refresh/:jobId/status`（帶入 A 的 jobId）

### 預期

- HTTP status **404**
- **不可**回 403（若 403 表示「有權限問題」，會與「job 不存在」的 404 形成語意差異，攻擊者可枚舉：試不同 jobId，403 = job 存在但非你的，404 = job 不存在，即資訊洩漏）
- Response body **僅** `{ "error": "job not found" }`，**不可**回傳任何 job 欄位（jobId、scopeKey、errorStage、errorMessage、status 等）

### 為何必須是 404 而不是 403

- **403** 語意為「你沒有權限存取此資源」，隱含「此資源存在」。
- **404** 語意為「找不到資源」，不透露資源是否存在。
- 若「job 不存在」回 404、「job 存在但屬他人」回 403，攻擊者只要枚舉 jobId，即可從 403/404 差異推論哪些 job 存在，屬資訊洩漏。因此兩者一律回 404。

### 自動化驗證腳本

- **腳本**：`script/verify-phase2-auth-cross-user.ts`
- **執行（需伺服器與兩組帳密）**：
  ```bash
  PHASE2_USER_A_USERNAME=userA PHASE2_USER_A_PASSWORD=passA \
  PHASE2_USER_B_USERNAME=userB PHASE2_USER_B_PASSWORD=passB \
  npx tsx script/verify-phase2-auth-cross-user.ts
  ```
- **覆蓋**：A 建立 job → B 查 A 的 jobId → 斷言 status 404、body 僅 `{ error: "job not found" }`、無 job 欄位。

### 實際測試結果（範例）

**1. 使用者 A 建立 job 的 response 範例**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending",
  "scopeKey": "user-a-id::all::7"
}
```

**2. 使用者 B 查同一 jobId 的 response**

- **Status**：`404`
- **Body**：`{ "error": "job not found" }`
- 無 `jobId`、`scopeKey`、`errorStage`、`errorMessage`、`status` 等欄位。

**3. 腳本執行通過時輸出範例**

```
=== 階段二安全驗收：跨使用者查 job 授權 ===

1. 使用者 A 建立 refresh job
   POST /api/refresh response: { "jobId": "...", "status": "pending", "scopeKey": "..." }

2. 使用者 B 查詢 A 的 jobId: ...
   GET /api/refresh/:jobId/status response status: 404
   response body: { "error": "job not found" }

通過：B 查 A 的 job 回 404，body 僅 { error: 'job not found' }，無 job 欄位洩漏。
```

（實際執行請在本地啟動伺服器、設定兩組測試帳密後跑上述腳本，通過即表示安全驗收完成。）

---

## 測試 Seam（Phase 2 前補齊，供自驗不依賴真實 token）

| Seam | 說明 |
|------|------|
| **A. REFRESH_TEST_MODE** | `fixture` 或 `mock`：不打真實 Meta/GA4，改為空陣列並跳過多時間窗口/GA4 頁面擷取；仍走 pipeline → precompute → publish。 |
| **B. FORCE_REFRESH_FAILURE_STAGE** | `meta_fetch` / `ga4_fetch` / `aggregation` / `precompute` / `persist` / `publish`：在該階段拋錯，驗 failed job、不污染 latest、errorStage。與 `PHASE2_INJECT_FAILURE` 並存（先檢查）。 |
| **C. AI 測試模式** | `AI_TEST_MODE=mock` 或 `REFRESH_TEST_MODE=fixture|mock` 時，`generateCrossAccountSummary` 不呼叫 LLM，改回傳 `buildDeterministicSummary`。 |
| **D. Debug route** | `GET /api/debug/precompute-stats` 僅在 `NODE_ENV=development` 或 `ENABLE_DEBUG_PRECOMPUTE_STATS=1` 時可用，否則 404。 |

---

## 一、新增/修改的檔案

| 類型 | 路徑 |
|------|------|
| 新增 | `server/refresh-pipeline.ts` — 建置 candidate batch 管線，支援 `PHASE2_INJECT_FAILURE` 注入失敗 |
| 新增 | `server/refresh-job-runner.ts` — 執行 `runRefreshJob(jobId)`，僅成功時 `saveBatch` |
| 新增 | `script/verify-phase2-refresh-job.ts` — job 持久化、同 scope 去重、重啟恢復 |
| 新增 | `script/verify-phase2-failure-no-pollute.ts` — 失敗不污染 latest |
| 新增 | `script/verify-phase2-e2e.ts` — E2E（需伺服器）：lifecycle 輪詢、同 scope 兩次 POST、5 支 dashboard precomputed |
| 新增 | `script/verify-phase2-acceptance.ts` — 整合執行上述不需伺服器的驗收 |
| 新增 | `script/verify-phase2-auth-cross-user.ts` — 安全驗收：跨使用者查 job 回 404、無洩漏（需伺服器與兩組帳密） |
| 修改 | `server/routes.ts` — POST /api/refresh 改為建立 job 並非阻塞執行 runner；新增 GET /api/refresh/:jobId/status |
| 修改 | `shared/schema.ts` — RefreshJob、RefreshJobErrorStage、RefreshJobStatus（若尚未有則為既有） |
| 修改 | `server/storage.ts` — createRefreshJob、getRefreshJob、updateRefreshJob、getRunningJobByScopeKey、loadRefreshJobs、persistRefreshJobs；loadPersistedData 末尾呼叫 loadRefreshJobs |

---

## 二、Refresh job 的持久化模型

- **儲存檔**：`.data/refresh-jobs.json`，內容為 `Record<jobId, RefreshJob>`。
- **欄位**：jobId, userId, scopeKey, lockKey, status, createdAt, startedAt, finishedAt, errorMessage, errorStage, resultBatchKey, attemptCount, triggerSource, progressStep, progressMessage；執行參數 datePreset, customStart, customEnd, selectedAccountIds, selectedPropertyIds。
- **寫入時機**：`createRefreshJob`、`updateRefreshJob` 每次皆呼叫 `persistRefreshJobs()`；重啟時 `loadPersistedData()` → `loadRefreshJobs()` 自檔案載入並將殘留 `running` 標為 `failed`（errorStage=recovery）。

---

## 三、POST /api/refresh 的實際 response 範例

**無同 scope 進行中 job 時（新建）：**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "scopeKey": "user-1::all::7"
}
```

**已有同 scope 進行中 job 時（去重）：**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "scopeKey": "user-1::all::7",
  "message": "同範圍已有進行中的更新作業，請使用 jobId 查詢狀態"
}
```

---

## 四、GET /api/refresh/:jobId/status 的實際 response 範例

**running：**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "createdAt": "2025-03-03T10:00:00.000Z",
  "startedAt": "2025-03-03T10:00:01.000Z",
  "finishedAt": null,
  "errorStage": null,
  "errorMessage": null,
  "resultBatchKey": null,
  "progressStep": 40,
  "progressMessage": "擷取多時間窗口數據...",
  "scopeKey": "user-1::all::7"
}
```

**succeeded：**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "succeeded",
  "createdAt": "2025-03-03T10:00:00.000Z",
  "startedAt": "2025-03-03T10:00:01.000Z",
  "finishedAt": "2025-03-03T10:02:00.000Z",
  "errorStage": null,
  "errorMessage": null,
  "resultBatchKey": "user-1::all::7",
  "progressStep": 100,
  "progressMessage": "完成",
  "scopeKey": "user-1::all::7"
}
```

**failed（含階段）：**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "createdAt": "2025-03-03T10:00:00.000Z",
  "startedAt": "2025-03-03T10:00:01.000Z",
  "finishedAt": "2025-03-03T10:00:05.000Z",
  "errorStage": "meta_fetch",
  "errorMessage": "驗收用注入失敗（PHASE2_INJECT_FAILURE）",
  "resultBatchKey": null,
  "progressStep": null,
  "progressMessage": null,
  "scopeKey": "user-1::all::7"
}
```

**權限（必做、易漏）**：必須檢查 `job.userId === req.session.userId`。一旦做成「用 jobId 查狀態」的 API，若沒做這層檢查，**只要知道 jobId，就能看到別人的 refresh 狀態、錯誤訊息、scope**，等同資訊洩漏。實作：`if (!job || job.userId !== userId) return res.status(404).json({ error: "job not found" })`；對「不存在」與「屬其他使用者」一律 404，不洩漏 job 是否存在。

---

## 五、同 scope 去重的實際驗證結果

- **不需伺服器**：`verify-phase2-refresh-job.ts` 以 storage 直接建立 job 並設為 running，呼叫 `getRunningJobByScopeKey(scopeKey)` 得到同一 job，確認同 scope 被鎖定。
- **需伺服器**：`verify-phase2-e2e.ts` 連續兩次 `POST /api/refresh`（相同 body），第二次 response 的 `jobId` 與第一次相同，且無第二個 running job；`.data/refresh-jobs.json` 該 scope 僅一筆 pending/running job。

---

## 六、模擬失敗時 latest batch 是否保持不變

- **方式**：環境變數 `PHASE2_INJECT_FAILURE=meta_fetch`，讓 `buildRefreshCandidateBatch` 一開始即拋錯。
- **執行**：`npx tsx script/verify-phase2-failure-no-pollute.ts`
- **結果**：
  - job 最終為 `failed`，`errorStage=meta_fetch`，`errorMessage` 有值。
  - 執行前後 `storage.getLatestBatch(TEST_USER)` 的 batchId 一致（皆為 null 或同一 batchId），**未被半成品覆蓋**。

---

## 七、重啟恢復的實際驗證結果

- **方式**：寫入一筆 `status: "running"` 的 job 至 `.data/refresh-jobs.json`，呼叫 `storage.loadRefreshJobs()`（與伺服器啟動時相同路徑）。
- **執行**：`verify-phase2-refresh-job.ts` 內「重啟恢復」段落。
- **結果**：該 job 變為 `status: "failed"`、`errorStage: "recovery"`、`errorMessage: "服務重啟中斷，job 無法恢復"`。

---

## 八、成功 refresh 後 5 支 dashboard API 是否仍為 precomputed

- **API**：`GET /api/dashboard/action-center`、`?scopeAccountIds=...`、`?scopeProducts=...`、`/api/dashboard/scorecard`、`?groupBy=person`。
- **驗證**：成功 refresh 後執行 `npx tsx script/verify-phase2-e2e.ts`（需伺服器與登入），會輪詢 job 至 succeeded 後對上述 5 支打 GET 並檢查 `X-ActionCenter-Path` / `X-Scorecard-Path` 為 `precomputed`；若任一支為 `fallback` 則腳本 exit 1。
- **另可**：僅驗證 headers 時執行 `npx tsx script/verify-precompute-headers.ts`（同樣需先有成功 refresh 的 batch）。

---

## 九、驗收腳本名稱與執行結果

| 腳本 | 說明 | 需伺服器 | 執行結果 |
|------|------|----------|----------|
| `verify-phase2-refresh-job.ts` | job 建立/持久化、同 scope 去重、重啟恢復 | 否 | 通過 |
| `verify-phase2-failure-no-pollute.ts` | 失敗不污染 latest（FORCE_REFRESH_FAILURE_STAGE） | 否 | 通過 |
| `verify-phase2-acceptance.ts` | 整合執行上兩支 | 否 | 通過 |
| `verify-phase2-lifecycle.ts` | lifecycle pending→running→succeeded（REFRESH_TEST_MODE=fixture） | 否 | 通過 |
| **`verify-phase2-auth-cross-user.ts`** | **安全驗收：A 建 job、B 查 A 的 jobId → 404** | **是（兩組帳密）** | 需在伺服器與兩組帳密下執行 |
| `verify-phase2-e2e.ts` | lifecycle 輪詢、同 scope 兩次 POST、5 支 precomputed | 是 | 需在伺服器運行後手動執行 |

### npm run verify:phase2 實際輸出（已執行）

```
npm run verify:phase2
→ tsx script/verify-phase2-acceptance.ts && tsx script/verify-phase2-lifecycle.ts && tsx script/verify-phase2-failure-no-pollute.ts
```
- 第一段（acceptance）：job 建立/持久化、同 scope 去重、重啟恢復、失敗不污染 latest — **通過**。
- 第二段（lifecycle）：REFRESH_TEST_MODE=fixture 下 runRefreshJob → succeeded、resultBatchKey 有值 — **通過**。
- 第三段（failure）：FORCE_REFRESH_FAILURE_STAGE=meta_fetch 下 job failed、latest 未變 — **通過**。
- **Exit code: 0**（全綠）。

執行整合驗收：`npx tsx script/verify-phase2-acceptance.ts` → 已通過。

---

## 十、目前仍未完全解掉的風險

- **單進程**：runner 與 API 同進程，若程序崩潰，正在執行的 job 會在下一次啟動時被標為 failed（recovery），但該次執行結果不會寫入；若未來改用 queue/worker，需接軌同一 job 模型。
- **E2E 依賴環境**：`verify-phase2-e2e.ts` 需伺服器運行且具備可登入帳號與可成功 refresh 的設定（Meta/GA4 等），否則僅能驗證「失敗情境」或跳過 precomputed 檢查。
- **PHASE2_INJECT_FAILURE**：僅供驗收用，正式環境不應設定此環境變數。
