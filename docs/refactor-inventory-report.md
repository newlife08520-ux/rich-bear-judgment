# 華麗熊系統重構 — 盤點報告

## 1. 實際找到的檔案與路徑

| 項目 | 實際路徑 | 說明 |
|------|----------|------|
| routes | `server/routes.ts` | 主 API 註冊，含 action-center、scorecard、refresh、workbench/tasks/batch |
| action-center API | `GET /api/dashboard/action-center` | routes.ts 約 L2449 |
| scorecard API | `GET /api/dashboard/scorecard` | routes.ts 約 L2070 |
| refresh API | `POST /api/refresh` (L1404)、`GET /api/refresh/status` (L1727) | 無 jobId，status 僅 in-memory |
| workbench tasks batch | `POST /api/workbench/tasks/batch` (L2316)、`PATCH .../batch` (L3271) | 逐筆 createWorkbenchTask → N+1 |
| tag-aggregation-engine | `shared/tag-aggregation-engine.ts` | parseCampaignNameToTags、aggregateByProductWithResolver、aggregateByCreativeTagsWithResolver |
| scale-score-engine | `shared/scale-score-engine.ts` | computeScaleReadiness、getBudgetRecommendation、getTrendABC、creativeEdge |
| gemini | `server/gemini.ts` | callGeminiChat（審判/聊天實際使用）、callGeminiContentJudgment；無在此做 markdown JSON 擷取 |
| rich-bear-prompt-assembly | `server/rich-bear-prompt-assembly.ts` | getAssembledSystemPrompt、buildDataContextSection |
| AI 結構化解析 | `server/parse-structured-judgment.ts` | parseStructuredJudgmentFromResponse — **使用** ````(?:json)?\s*([\s\S]*?)```` 擷取 JSON |
| AnalysisBatch 型別 | `shared/schema.ts` L1552 | interface AnalysisBatch，**非** Prisma model |
| Batch 儲存 | `server/storage.ts` | MemStorage：batchStore (Map) + 持久化到 `.data/latest-batch.json`；saveBatch/getLatestBatch/getBatchForScope |
| Prisma schema | `prisma/schema.prisma` | WorkbenchTask、WorkbenchOwner、WorkbenchAudit、WorkbenchMapping、ThresholdVersion、PromptVersion；**無** AnalysisBatch |
| Refresh 狀態 | `server/storage.ts` | getRefreshStatus/setRefreshStatus — **僅記憶體** Map，未持久化 |
| Multer 上傳 | `server/routes.ts` L626、`server/modules/asset/asset-package-routes.ts` L12 | 皆 `multer.memoryStorage()`；content-judgment 限 200MB、asset 100MB |
| 相關型別 / Zod | `shared/schema.ts` | AnalysisBatch、RefreshStatus、StructuredJudgment、CampaignMetrics、ProductLevelMetrics 等；settingsSchema、contentJudgmentInputSchema 等 |
| Prompt 組裝 | `server/prompts/rich-bear-core.ts`、`server/rich-bear-persona.ts`、`server/rich-bear-calibration.ts`、`server/rich-bear-workflow-overlays.ts` | 五層架構；assembly 在 rich-bear-prompt-assembly.ts |

---

## 2. API / 模組耦合關係

- **GET /api/dashboard/action-center**  
  - 依賴：`getBatchFromRequest(req)` → `storage.getLatestBatch(userId, scopeKey)`  
  - 每次請求：`aggregateByProductWithResolver`、`aggregateByCreativeTagsWithResolver`、整份 `campaignMetrics` 做 `budgetActionTable`（每筆 `computeScaleReadiness`、`getScaleBudgetRecommendation`）、`creativeLeaderboard`（`classifyMaterialTier`、Scale 引擎）、`toRoiRows`/`computeRoiFunnel` 未在此直接用，但 scorecard 用。  
  - 與 scorecard 共用同一 batch 來源，但 action-center 自己做大量聚合與 Scale/ROI 計算。

- **GET /api/dashboard/scorecard**  
  - 依賴：`getBatchFromRequest(req)`、`getWorkbenchMappingOverrides()`、`toRoiRows`、`computeBaselineFromRows`、`computeRoiFunnel`、`getBaselineFor`、`getPublishedThresholdConfig()`。  
  - 每次請求：遍歷 campaigns → resolveProduct → toRoiRows → 依 product 做 computeRoiFunnel、byProduct/byBuyer/byCreative 彙總。

- **POST /api/refresh**  
  - 設定 isRefreshing 後立即 `res.json({ success, message, started })`，實際工作在 async IIFE 內：  
    - 同步帳號、`Promise.all` 呼叫 Meta/GA4（無併發限制）、多時間窗口、GA4 頁面、scoring-engine 全量計算、analysis-engine、buildBoardSet、generateCrossAccountSummary、組裝 batch、`storage.saveBatch(userId, batch)`、最後 setRefreshStatus(false)。  
  - 與 storage 耦合：saveBatch 覆寫該 userId/scopeKey 的 batch；無 job 表、無 jobId、重啟後任務遺失。

- **POST /api/workbench/tasks/batch**  
  - `body.items` 迴圈內對每筆 `await createWorkbenchTask(...)` → 多次 `prisma.workbenchTask.create`（N+1）。

- **審判官 Chat**（routes 內審判 flow）  
  - 使用 `getAssembledSystemPrompt`、`buildDataContextSection`；取得 `assistantText` 後呼叫 `parseStructuredJudgmentFromResponse(assistantText)`（依賴 markdown JSON regex），結果寫入 message.structuredJudgment。

---

## 3. 需要 schema / migration 的部分

- **AnalysisBatch**：目前僅 TypeScript interface，儲存於 JSON 檔。  
  - **不需 Prisma migration**。  
  - 需在 `shared/schema.ts` 擴充 AnalysisBatch：`precomputedActionCenter`、`precomputedScorecard`、`precomputeCompletedAt`、`computationVersion`（與必要時 `sourceWindow` / `promptVersion`）。  
  - `server/storage.ts` 讀寫 batch 時一併讀寫上述欄位；舊 batch 無這些欄位時 GET 需 fallback 至現行即時計算（或回傳空/標記需 refresh）。

- **Refresh Job 可追蹤**：  
  - 若採用 BullMQ：需 Redis，可能需新 migration 存 jobId ↔ userId/scope。  
  - 若採用「僅持久化 job status」：可在 `server/storage.ts` 新增 JSON 檔（如 `.data/refresh-jobs.json`）或新增 Prisma 表（例如 `RefreshJob`）存 jobId、userId、scopeKey、status、createdAt、completedAt、error。  
  - 本盤點建議：先以「記憶體 Map + 單一 JSON 檔」實作 job 狀態持久化，不引入 Redis，以符合「若專案現況不適合 BullMQ」的選項。

---

## 4. 必須保持相容的 response shape

- **GET /api/dashboard/action-center**  
  - 現有前端依賴：`batchValidity`、`sourceMeta`、`productLevel`、`productLevelMain`、`productLevelNoDelivery`、`productLevelUnmapped`、`unmappedCount`、`creativeLeaderboard`、`creativeLeaderboardUnderSample`、`hiddenGems`、`urgentStop`、`riskyCampaigns`、`failureRatesByTag`、`budgetActionTable`、`budgetActionNoDelivery`、`budgetActionUnderSample`、`tableRescue`、`tableScaleUp`、`tableNoMisjudge`、`tableExtend`、`todayActions`、`tierMainAccount`、`tierHighPotentialCreatives`、`tierNoise`、`funnelEvidence`。  
  - 重構後：從 batch 的 `precomputedActionCenter` 讀取並回傳相同結構；若無預計算則 fallback 維持現有計算邏輯，不新增必填欄位，僅在 sourceMeta 等處可加 `computationVersion` 等選填欄位。

- **GET /api/dashboard/scorecard**  
  - `groupBy === "product"`：`{ items, groupBy }`，items 元素含 `name`、`launchedCount`、`successCount`、`successRate`、`avgDaysToTarget`、`retirementReasons`、`luckyRate`、`funnelPassRate`、`avgQualityScore`。  
  - `groupBy === "person"`：`{ groupBy: "person", itemsByBuyer, itemsByCreative }`，同一 item shape。  
  - 重構後：從 batch 的 `precomputedScorecard` 讀取並回傳；若無則 fallback 現有邏輯。

- **POST /api/refresh**  
  - 目前：`{ success, message, started? }` 或 `{ success, alreadyRunning: true }`。  
  - 重構後：改為回傳 `{ success, jobId, message }`；既有 `alreadyRunning` 可保留或改為「同 scope 已有 running job 時回傳該 jobId」。  
  - **GET /api/refresh/status**：目前 `RefreshStatus`（isRefreshing、currentStep、progress、lastRefreshedAt 等）。可擴充為含 `jobId`、`status: pending|running|succeeded|failed`，舊欄位保留。

- **審判官 Chat 回傳**  
  - 訊息中的 `structuredJudgment` 形狀為 `StructuredJudgment`；parse 失敗時不可讓 API crash、不可回傳整份 null，需安全 fallback 物件並記錄錯誤。

---

## 5. 預計修改的檔案（按階段）

| 階段 | 預計修改檔案 |
|------|----------------|
| 一 | `shared/schema.ts`、`server/storage.ts`、`server/routes.ts`（action-center、scorecard 讀預計算 + fallback；refresh 管線寫入預計算）、`shared/tag-aggregation-engine.ts`（cache + fallback 解析）、抽出「action-center 預計算函式」與「scorecard 預計算函式」以便 refresh 呼叫 |
| 二 | `server/routes.ts`（POST /api/refresh 改回 jobId；GET /api/refresh/status 或 GET /api/refresh/:jobId/status）、`server/storage.ts` 或新檔（refresh job 狀態持久化）、refresh 執行端改為可追蹤 job、原子切換最新成功 batch |
| 三 | 外部 API 呼叫處（meta-data-fetcher、ga4-data-fetcher 或 routes 內 refresh 呼叫）加 `p-limit`、retry/backoff；multer 改 disk + MIME/檔名/cleanup；`server/workbench-db.ts` + routes 的 POST workbench/tasks/batch 改為 createMany 或等效批次 |
| 四 | `server/gemini.ts` 或審判 flow 使用 structured output API（若 Gemini 支援）；`server/parse-structured-judgment.ts` 改為 zod 驗證 + 安全 fallback，廢除依賴 markdown 區塊的 regex |
| 五 | `server/rich-bear-prompt-assembly.ts`（Data Context 護欄、限縮為高價值摘要） |
| 六 | 觀測用 logging、metrics hook；單元/整合/contract 測試；若有 benchmark 則比較前後 |

---

以上為盤點報告；接下來依階段一至階段六在 codebase 中實際落地修改。

---

## 階段一執行摘要（已完成部分）

### 已修改檔案

1. **shared/schema.ts**
   - 新增 `BATCH_COMPUTATION_VERSION`、`PrecomputedActionCenterPayload`、`PrecomputedScorecardPayload`。
   - `AnalysisBatch` 新增選填欄位：`precomputedActionCenter`、`precomputedScorecard`、`precomputeCompletedAt`、`computationVersion`。

2. **shared/tag-aggregation-engine.ts**
   - 新增 `campaignParseCache`（Map）與 `clearCampaignParseCache()`。
   - `parseCampaignNameToTags` 改為先查 cache，regex 失敗時改為呼叫 `fallbackParseCampaignName`（以 `-` 切分搶救 productName），結果寫回 cache。

3. **server/routes.ts**
   - `GET /api/dashboard/action-center`：若有 `batch.precomputedActionCenter` 且無 scope，直接 `res.json(batch.precomputedActionCenter)`，否則維持既有即時計算。
   - `GET /api/dashboard/scorecard`：若有 `batch.precomputedScorecard` 則依 `groupBy` 回傳對應預計算，否則維持既有即時計算。
   - `POST /api/refresh` 管線：僅在預計算成功後寫入 `batch.precomputedActionCenter`、`batch.precomputedScorecard`、`batch.precomputeCompletedAt`、`batch.computationVersion`。

### 未破壞之項目

- 既有商業公式與 Scale / ROI 邏輯未改。
- GET 回傳形狀不變；僅在「有預計算且無 scope」時改為回傳預計算物件。
- 舊 batch 無新欄位時，GET 仍走既有即時計算（backward compatible）。

### 階段一補完（已落地）

1. **buildActionCenterPayload / buildScorecardPayload 位置**
   - `server/build-action-center-payload.ts`：`buildActionCenterPayload(batch, options)`、`filterActionCenterPayloadByScope(payload, scopeAccountIds?, scopeProducts?)`
   - `server/build-scorecard-payload.ts`：`buildScorecardPayload(batch)`

2. **/api/refresh 預計算寫入時機**
   - 在 `storage.saveBatch(userId, batch)` 之前：`clearCampaignParseCache()` 在 refresh 一開始執行。
   - 以 `Promise.all([ buildActionCenterPayload(batch, { useOverrides: true }), buildScorecardPayload(batch) ])` 產生兩份 payload。
   - **僅在兩者皆成功** 時才寫入 `batch.precomputedActionCenter`、`batch.precomputedScorecard`、`batch.precomputeCompletedAt`、`batch.computationVersion`；任一步失敗則不寫入上述欄位，GET 走 fallback。

3. **Scoped GET 輕量 filter**
   - GET `/api/dashboard/action-center`：若有 `batch.precomputedActionCenter`，一律用 `filterActionCenterPayloadByScope(payload, scopeAccountIds, scopeProducts)` 做陣列篩選與 sourceMeta 重算後回傳，**不再執行** 聚合／Scale 引擎。
   - GET `/api/dashboard/scorecard`：無 scope 參數，有 `precomputedScorecard` 時依 `groupBy` 直接回傳對應區塊。

4. **舊 batch fallback 保留處**
   - `server/routes.ts`：當 `!batch.precomputedActionCenter` 時走即時計算並 `console.warn("[ActionCenter] Fallback live compute (batch has no precomputedActionCenter)")`。
   - 成績單：當 `!batch.precomputedScorecard` 時走即時計算並 `console.warn("[Scorecard] Fallback live compute (batch has no precomputedScorecard)")`。
   - 註解已標示為「僅供舊 batch 過渡使用」。

5. **campaignParseCache 生命週期與保護**
   - Key 正規化：`normalizeCacheKey(name)`（trim、collapse 空白、\u00A0 → 空格）。
   - 上限：`CACHE_MAX_SIZE = 10000`，超過時 evict 一半（FIFO）。
   - 清空時機：**refresh 開始時** 呼叫 `clearCampaignParseCache()`；測試或需控管時可手動呼叫。匯出 `getCampaignParseCacheSize()` 供觀測。

6. **新欄位持久化**
   - `AnalysisBatch` 僅 TypeScript 介面，batch 存於 `server/storage.ts` 的 `batchStore` 並寫入 `.data/latest-batch.json`。
   - `saveBatch(userId, batch)` 將整個 `batch` 物件寫入 JSON，**未** 過濾欄位，故 `precomputedActionCenter`、`precomputedScorecard`、`precomputeCompletedAt`、`computationVersion` 會一併持久化並在讀取時存在。

7. **仍會執行重型計算的 GET 路徑**
   - 僅當 **batch 無 precomputedActionCenter**（例如舊資料或預計算失敗）時，GET action-center 會執行完整即時計算（聚合、Scale、創意榜等）。
   - 僅當 **batch 無 precomputedScorecard** 時，GET scorecard 會執行完整 ROI/scorecard 即時計算。
   - 新 refresh 成功完成預計算後，上述路徑不再觸發；CQRS 在「有預計算」情境下已完成。
