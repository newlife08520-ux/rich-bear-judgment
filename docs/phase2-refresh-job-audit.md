# 階段二 Refresh Job 盤點（先盤點再動手）

## 一、現有 refresh 流程與盤點結果

### 1. POST /api/refresh 目前實際執行步驟（順序）

| 步驟 | 說明 | 可能失敗點 |
|------|------|------------|
| 1 | 檢查 `getRefreshStatus(userId).isRefreshing`，若 true 直接回傳 alreadyRunning | 否 |
| 2 | `setRefreshStatus(userId, { isRefreshing: true, ... })`（**僅記憶體**） | 否 |
| 3 | **立即** `res.json({ success, message, started: true })` | 否 |
| 4 | 進入 async IIFE（與 request 解耦）：clearCampaignParseCache() | 否 |
| 5 | 同步帳號（可選）：若 selectedAccountIds 有缺，呼叫 Meta API 補齊並 saveSyncedAccounts | **meta_fetch**（網路／token） |
| 6 | 過濾 metaAccounts / ga4Accounts 依 selectedAccountIds / selectedPropertyIds | 否 |
| 7 | **擷取 Meta 與 GA4 數據**：Promise.all [ fetchMetaCampaignData × N, fetchGA4FunnelData × M ] | **meta_fetch** / **ga4_fetch** |
| 8 | 擷取多時間窗口：fetchMultiWindowMetrics（Meta） | **meta_fetch** |
| 9 | 擷取 GA4 頁面數據：fetchGA4PageData | **ga4_fetch** |
| 10 | **計算三維評分與風險**：computeAccountAvg、calculateCampaignTriScore、classifyRiskLevel、evaluateStopLoss、buildCampaignScoringResult 等 | **aggregation**（理論上可拋錯） |
| 11 | 異常檢測與分析：detectCampaignAnomalies、detectGA4Anomalies、calculateAccountHealth | **aggregation** |
| 12 | 識別機會與風險：identifyRiskyCampaigns、classifyOpportunities | **aggregation** |
| 13 | V2 評分與戰情板：buildBoardSet、buildPageScoringResult、buildAccountScoringResult | **aggregation** |
| 14 | **產生 AI 策略摘要**：generateCrossAccountSummary（Gemini） | **ai_summary**（外部 API） |
| 15 | 組裝 **candidate batch**（AnalysisBatch），含 campaignMetrics、summary、boards 等 | 否 |
| 16 | **預計算**：buildActionCenterPayload(batch)、buildScorecardPayload(batch)，成功後寫入 batch 的 precomputed* 欄位 | **precompute** |
| 17 | **storage.saveBatch(userId, batch)** → 寫入 batchStore（scopeKey + userId）並 **整份** 寫入 `.data/latest-batch.json` | **persist** |
| 18 | setRefreshStatus(userId, { isRefreshing: false, currentStep: "完成", progress: 100, ... }) | 否 |
| catch | 任一步驟拋錯 → setRefreshStatus(..., currentStep: "失敗: ...", progress: 0)；**不** 呼叫 saveBatch | — |

### 2. 哪些步驟屬於外部依賴

- **meta_fetch**：步驟 5、7、8（Meta Graph API、token、網路）
- **ga4_fetch**：步驟 7、9（GA4 API、GOOGLE_SERVICE_ACCOUNT_KEY、網路）
- **ai_summary**：步驟 14（Gemini API、settings.aiApiKey）

### 3. 哪些步驟成功後才算 batch 可對外發布

- 步驟 1～15 全部成功 → 得到完整 **candidate batch**（含 summary）。
- 步驟 16 成功 → candidate 具 precomputedActionCenter / precomputedScorecard（可走 precomputed 讀路徑）。
- 步驟 17 成功 → **才可視為「latest 已切換」**；在此之前舊 batch 仍為 GET 所用。

因此：**只有當步驟 17（saveBatch）被執行且未拋錯時，才允許對外發布（latest 切換）**。若在 16 之前失敗，不寫入任何 batch；若 16 失敗，目前仍會執行 17（寫入無 precomputed 的 batch），階段二應改為：**僅當 16 也成功時才執行 17**（與階段一「兩份 payload 都成功才寫入」一致，且整體視為 publish 條件）。

### 4. 目前 latest batch 在哪裡被寫入或覆蓋

- **唯一寫入點**：`storage.saveBatch(userId, batch)`（routes 約 L1731）。
- **saveBatch 行為**（storage.ts）：
  - `scopeKey = buildScopeKey(userId, batch.selectedAccountIds, batch.selectedPropertyIds, batch.dateRange.preset)`（格式：`userId::scope::datePreset`，例如 `1::all::7`、`1::act1,act2|prop1::7`）。
  - `batchStore.set(scopeKey, batch)`；`batchStore.set(userId, batch)`。
  - 將整個 batchStore 序列化寫入 `.data/latest-batch.json`。
- **覆蓋**：同一個 userId（及同一 scopeKey）的後一次 saveBatch 會覆蓋前一次；**沒有**「先寫暫存再原子切換」的設計，目前是「算完直接寫入」，若在寫入前拋錯則不會寫入（舊 batch 保留）。

### 5. storage.saveBatch、getLatestBatch、loadPersistedData 與 batchStore 的互動

- **batchStore**：`Map<string, AnalysisBatch>`，key 為 scopeKey 或 userId（saveBatch 會寫兩鍵：scopeKey 與 userId）。
- **loadPersistedData**：從 `.data/latest-batch.json` 讀入，對每個 key 做 `batchStore.set(key, batch)`，並依 `batch.userId` 回建「每個 userId 的 latest」寫入 batchStore（優先 precomputed，再依 precomputeCompletedAt / generatedAt）。
- **getLatestBatch(userId, scopeKey?)**：若傳 scopeKey 則 `batchStore.get(scopeKey)`，否則 `batchStore.get(userId)`。
- **saveBatch**：寫入 batchStore 的 scopeKey 與 userId 兩鍵，並整份寫回檔案；**沒有**獨立的「candidate → publish」兩階段。

### 6. 現在 refresh 的 scope 維度

- **請求參數**：`userId`（session）、`datePreset`、`customStart`/`customEnd`、`selectedAccountIds`、`selectedPropertyIds`。
- **scopeKey**（與 buildScopeKey 一致）：  
  `userId + "::" + (sortedAccountIds + "|" + sortedPropertyIds 或 "all") + "::" + datePreset`  
  例如：`1::all::7`、`1::act1,act2|prop1::7`。
- **同 scope 去重**：目前僅用 `getRefreshStatus(userId).isRefreshing`，**只區分 userId**，未區分 scopeKey。因此同一使用者若用不同 scope 連續打兩次 refresh，會互相覆蓋 isRefreshing，且可能並行兩份 IIFE，最後 saveBatch 誰後寫誰贏，無鎖也無 job 概念。

### 7. 哪裡適合插入 job state 的更新

- **建立 job**：在檢查「同 scope 是否已有 pending/running」之後、啟動 runner 之前，建立 job 並寫入持久化，狀態 `pending`。
- **開始執行**：runner 入口將 job 更新為 `running`，寫入 `startedAt`。
- **每個可失敗階段結束後**：更新 `progressStep` / `progressMessage`（可選）；任一步驟失敗時更新為 `failed`，寫入 `errorStage`、`errorMessage`、`finishedAt`。
- **預計算成功且即將 saveBatch 前**：仍為 `running`；僅在 saveBatch 成功後將 job 更新為 `succeeded`，寫入 `finishedAt`、`resultBatchKey`（或等價）。
- **saveBatch 失敗**：job 更新為 `failed`，errorStage = `persist`。

### 8. 同 scope 的去重鎖應該用什麼 key

- **建議**：`lockKey = scopeKey`，即 `buildScopeKey(userId, selectedAccountIds, selectedPropertyIds, datePreset)`。
- 同一 scopeKey 下只允許一個 job 處於 `pending` 或 `running`；新請求可回傳既有 jobId 或 409 拒絕。

---

## 二、小結（對應規格）

1. **refresh 實際步驟**：見上表；從同步帳號到 saveBatch 共約 18 步，其中 5、7、8、9、14 為外部依賴，10～13、16 可能拋錯，17 為唯一寫入 latest 處。
2. **外部依賴**：Meta、GA4、AI（Gemini）。
3. **可對外發布條件**：外部抓取 + 聚合 + 預計算 + **saveBatch 成功**；在此之前不可覆蓋 latest。
4. **job state 插入點**：建立 job（pending）→ runner 開始（running）→ 各階段可更新 progress → 失敗（failed）或 saveBatch 後成功（succeeded）。
5. **同 scope 去重 key**：`scopeKey = buildScopeKey(userId, selectedAccountIds, selectedPropertyIds, datePreset)`。

下一步：依此盤點實作 Refresh Job 資料模型、持久化、API 重構、job runner、原子切換與去重鎖。
