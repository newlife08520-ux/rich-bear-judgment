# 預計算路徑驗證與階段一驗收

本文說明路徑行為、重型函式是否執行、**結果一致性**、**持久化**與**路徑覆蓋率**驗證方式，以及實際驗證情境與回報格式。

**階段一驗收結論（最終版）**  
階段一已完成驗收。根因已修正（`getLatestBatch(userId)` 與 persisted batch key 對齊、`loadPersistedData()` 依 `batch.userId` 回建索引並依規則選 latest）；重啟後 5 支核心 API 實測皆為 precomputed。預計算與 fallback 關鍵輸出一致、完整性保護、防半成品污染、fallback 可觀測性與 cache 治理均已完成。**可進入階段二。**

---

## 一、結果一致性驗證

**目的**：證明「走 precomputed」時的輸出與「走 fallback」時一致（不是只驗路徑，而是驗輸出）。

### 驗證情境（至少 5 個）

| 情境 | 說明 |
|------|------|
| 1. `GET /api/dashboard/action-center` | 無 scope，precomputed 全量 vs fallback 全量 |
| 2. `GET /api/dashboard/action-center?scopeAccountIds=...` | scoped by account，scoped precomputed vs scoped fallback |
| 3. `GET /api/dashboard/action-center?scopeProducts=...` | scoped by product，scoped precomputed vs scoped fallback |
| 4. `GET /api/dashboard/scorecard` | 成績單 product，precomputed vs fallback |
| 5. `GET /api/dashboard/scorecard?groupBy=person` | 成績單 person，precomputed vs fallback |

### 比對欄位（至少）

- **item 數量**：`productLevel`、`productLevelMain`、`budgetActionTable`、`todayActions`、`sourceMeta.campaignCountUsed`；scorecard 的 `product.items.length`、`person.itemsByBuyer` / `itemsByCreative`。
- **前幾名排序**：`productLevelMain` 前 3 筆 `productName`、`spend`。
- **主要分數／指標**：scorecard `launchedCount`、`successRate`。
- **sourceMeta**：`campaignCountUsed`、`scopeKey`（scoped 時會重算）。
- **建議動作與百分比**：`budgetActionTable` 前 2 筆 `suggestedAction`、`suggestedPct`。

### 允許的微小差異

- 數值容差：`suggestedPct`、`successRate` 等浮點數容差 `1e-5` 或小數四捨五入差 < 0.01 視為一致。
- 若存在其他允許差異，請在「實際驗證回報」中明確列出原因。

### 如何執行

```bash
# 需先有一次 refresh 產生具 precomputed 的 batch（.data/latest-batch.json）
npm run verify:precompute:consistency
```

- 腳本會從 `.data/latest-batch.json` 讀取所有 batch，對**具 precomputedActionCenter 與 precomputedScorecard** 的 batch 做：
  - action-center unscoped：precomputed vs `buildActionCenterPayload(batch, { useOverrides: true })`
  - action-center scopeAccountIds：`filterActionCenterPayloadByScope(precomputed, scopeAccountIds, undefined)` vs `buildActionCenterPayload(batch, { scopeAccountIds, useOverrides: true })`
  - action-center scopeProducts：同上，scopeProducts
  - scorecard：precomputed vs `buildScorecardPayload(batch)`
- **預設**：若無任何 batch 具預計算，腳本 **exit 1**（CI/驗收把關，避免「沒驗到」被誤判為成功）。
- **寬鬆模式**：傳入 `--allow-missing-precomputed` 時，無 precomputed batch 則 exit 0。
- 若比對不一致或契約缺欄，腳本會 exit 1 並列出差異。
- **Response 契約**：腳本另檢查頂層不可缺欄與型別（action-center 白名單鍵、scorecard product/person 結構），避免前端依賴欄位漂移。

---

## 二、完整性保護檢查 vs 持久化成功驗證

### 區分兩者

- **完整性保護檢查**（`verify:precompute:persistence`）：只證明「**沒有**假完成、**沒有**部分污染、**沒有**payload 結構不完整」。  
  - 不證明「refresh 成功後真的寫入、重啟後真的讀到、API 真的走 precomputed」。
- **持久化成功驗證**：需實際執行 refresh、再讀檔或打 API，確認寫入與讀出、重啟後仍存在、GET 回傳 precomputed path。可搭配「實際 headers 驗證」腳本（見下文）。

### 完整性保護檢查內容

1. **假完成**：有 `precomputeCompletedAt` 或 `computationVersion` 的 batch，必須同時有 `precomputedActionCenter` 與 `precomputedScorecard`，且結構完整。
2. **部分污染**：不可只有其中一份 payload（例如只有 `precomputedActionCenter` 而沒有 `precomputedScorecard`）。refresh 失敗時應**不寫入任一半成品**（見下方實作要點）。
3. **實作要點**：refresh 時先用**區域變數**接住兩份 payload，兩者都成功後再一次性 assign 到 batch；catch 時不讓半成品寫回 batch。

### 如何執行

```bash
npm run verify:precompute:persistence
```

- 腳本會讀取 `.data/latest-batch.json`，對每個 batch 檢查：無假完成、無部分污染、無 payload 不完整。
- 若發現任一項，exit 1。

---

## 三、路徑覆蓋率與 fallback 過渡性

**目的**：確認新 refresh 產出的 batch 在 action-center / scorecard 上是否都走 precomputed，以及 fallback 僅在何種情況下發生。

### 設計結論

- **新 refresh 產出的 batch**：refresh 成功時會寫入 `precomputedActionCenter` 與 `precomputedScorecard`，因此之後的 GET 會走 **precomputed**（100% 走預計算，只要該 batch 被讀取）。
- **走 fallback 的情況**：
  - 該 batch **沒有** `precomputedActionCenter`（action-center）或 **沒有** `precomputedScorecard`（scorecard）：例如舊 batch（在引入預計算前產生的資料）、或本次 refresh 預計算步驟拋錯（catch 不寫預計算欄位）。
- **結論**：fallback 僅為**舊 batch 或預計算失敗**的過渡行為；新 refresh 成功後即為 precomputed 主路徑。

### 觀測 fallback 使用率（structured log + counter）

- **Counter**：fallback 時會呼叫 `incrementActionCenterFallback()` / `incrementScorecardFallback()`（`server/precompute-metrics.ts`），並輸出 **structured log**（JSON：`event: "precompute_path"`, `api`, `path: "fallback"`, `count`）。
- **查詢**：`GET /api/debug/precompute-stats` 回傳 `{ actionCenterFallback, scorecardFallback }`，可量化 fallback 次數，不依賴 log 字串搜尋。
- Response headers 仍為 `X-ActionCenter-Path`、`X-Scorecard-Path`（precomputed | fallback | empty），可與 counter 交叉比對。

---

## 四、Scoped filter 正確性

- **驗證方式**：已納入「結果一致性」腳本：scoped 時比較 `filterActionCenterPayloadByScope(precomputed, scopeAccountIds, scopeProducts)` 與 `buildActionCenterPayload(batch, { scopeAccountIds, scopeProducts, useOverrides: true })` 的關鍵欄位（數量、前幾名、sourceMeta、建議動作／百分比）。
- **預期**：篩選後 totals（含 sourceMeta.campaignCountUsed）、排序、排行榜、summary 與 fallback 的 scoped 結果一致；payload 保留 filter 所需欄位（如 `accountId`、`productName`），避免未來 scope 擴充又退回即時計算。

---

## 五、最小自動化測試（驗證腳本）

除本文件敘述外，以下腳本可保護預計算路徑與一致性：

| 腳本 | 保護內容 |
|------|----------|
| `script/verify-precompute-persistence.ts` | 完整性保護：無假完成、無部分污染、無 payload 不完整 |
| `script/verify-precompute-consistency.ts` | precomputed vs fallback 關鍵輸出一致 + response 契約（不可缺欄、型別一致） |
| `script/verify-precompute-headers.ts` | **實際 headers**：打 5 支 API 印出 path header，若任一為 fallback 則 exit 1 |

執行：

```bash
npm run verify:precompute
```

會先跑完整性保護，再跑一致性驗證；任一步失敗即 exit 1。

**實際 headers 驗證**（需服務已啟動且已登入）：

```bash
# 設登入資訊後執行（或 PRECOMPUTE_TEST_COOKIE=connect.sid=...）
PRECOMPUTE_TEST_USER=xxx PRECOMPUTE_TEST_PASSWORD=yyy npx tsx script/verify-precompute-headers.ts
```

---

## 六、如何驗證路徑（本地／手動看 header）

1. **啟動服務**後，對以下 API 發 GET（需已登入，帶 cookie 或 session）：
   - `GET /api/dashboard/action-center`
   - `GET /api/dashboard/action-center?scopeAccountIds=act_123`
   - `GET /api/dashboard/action-center?scopeProducts=商品A`
   - `GET /api/dashboard/scorecard`
   - `GET /api/dashboard/scorecard?groupBy=person`

2. **看 response headers**：
   - **Action-center**
     - `X-ActionCenter-Path`: `empty` | `precomputed` | `fallback`
     - `X-ActionCenter-Scoped`: `yes` | `no`（是否有帶 scope 參數）
   - **Scorecard**
     - `X-Scorecard-Path`: `empty` | `precomputed` | `fallback`

3. **預期**：
   - 做完一次 **refresh** 且預計算成功後，同一 batch 的 action-center / scorecard 應為 `precomputed`。
   - 尚未 refresh 或該 batch 為舊資料（無預計算）時，會是 `fallback`。
   - 無 batch 或無 campaign 時為 `empty`。

---

## 路徑與重型函式是否執行

### 1. 是否仍執行 `computeRoiFunnel`

| 情境 | computeRoiFunnel 是否執行 |
|------|---------------------------|
| **Action-center** | |
| 有預計算（scoped / unscoped） | **否**：只讀 `precomputedActionCenter` + 可選 `filterActionCenterPayloadByScope`（僅陣列 filter）。 |
| Fallback | **否**：action-center 本身**不呼叫** `computeRoiFunnel`（僅 scorecard / replacement-suggestions / lucky-tasks 等用 ROI funnel）。 |
| **Scorecard** | |
| 有預計算 | **否**：直接回傳 `precomputedScorecard.product` 或 `.person`。 |
| Fallback | **是**：`routes.ts` GET scorecard 內對每筆 `pairs` 呼叫 `computeRoiFunnel(row, baseline, thresholds)`（約 L2132）。 |

結論：**只有「scorecard 且走 fallback」時會執行 `computeRoiFunnel`**；有預計算或 action-center 皆不執行。

---

### 2. 是否仍執行 `computeScaleReadiness`

| 情境 | computeScaleReadiness 是否執行 |
|------|--------------------------------|
| **Action-center** | |
| 有預計算（scoped / unscoped） | **否**：只讀預計算 payload + 可選輕量 filter。 |
| Fallback | **是**：`routes.ts` 內建 `budgetActionTable`（每筆 campaign）與 `creativeLeaderboardRaw`（每筆創意）皆呼叫 `computeScaleReadiness(input)`（約 L2615、L2706）。 |
| **Scorecard** | |
| 有預計算 | **否**：只回傳預計算結果。 |
| Fallback | **否**：scorecard 路徑**不呼叫** `computeScaleReadiness`。 |

結論：**只有「action-center 且走 fallback」時會執行 `computeScaleReadiness`**；有預計算或 scorecard 皆不執行。

---

### 3. 是否仍執行整批 campaign regex 聚合

「整批 campaign regex 聚合」指：對本批 `campaignMetrics` 做 `parseCampaignNameToTags` + `aggregateByProductWithResolver` / `aggregateByCreativeTagsWithResolver`（即整批 campaign 名稱解析與商品／創意維度聚合）。

| 情境 | 整批 campaign regex 聚合是否執行 |
|------|----------------------------------|
| **Action-center** | |
| 有預計算（scoped / unscoped） | **否**：只讀已聚合好的 `productLevel`、`creativeLeaderboard` 等，scoped 時僅做陣列 filter。 |
| Fallback | **是**：`routes.ts` 內建 `rows` → `resolveProduct`（內含 `parseCampaignNameToTags`）→ `aggregateByProductWithResolver(rows, resolveProduct, scopeProducts)`、`aggregateByCreativeTagsWithResolver(...)`（約 L2572 起）。 |
| **Scorecard** | |
| 有預計算 | **否**：只回傳預計算的 items。 |
| Fallback | **是**：`routes.ts` GET scorecard 內 `toRoiRows(campaigns, resolveProduct)`，`resolveProduct` 使用 `parseCampaignNameToTags`；並有 `computeBaselineFromRows`、依 product 迴圈等（約 L2107–2132）。未再呼叫 `aggregateByProductWithResolver`，但有整批 campaign 的 parse + ROI 維度處理。 |

結論：**有預計算時兩支 API 都不做整批 campaign regex 聚合**；**fallback 時兩支都會**（action-center 做 product + creative 聚合，scorecard 做 toRoiRows + baseline + ROI 迴圈）。

---

### 4. Scoped 與 unscoped 各自走哪條路

**Action-center**

- **Unscoped**（無 `scopeAccountIds`、無 `scopeProducts`）  
  - 有預計算：讀 `batch.precomputedActionCenter` → `filterActionCenterPayloadByScope(payload, undefined, undefined)` → 原樣回傳（無 filter）。  
  - 無預計算：走 fallback，即時算整批（含聚合、Scale、創意榜），等同「全帳號／全商品」結果。

- **Scoped**（有 `scopeAccountIds` 或 `scopeProducts`）  
  - 有預計算：讀 `batch.precomputedActionCenter` → `filterActionCenterPayloadByScope(payload, scopeAccountIds, scopeProducts)` → 只做陣列篩選 + sourceMeta 重算後回傳。  
  - 無預計算：走 fallback，即時算時會用同一組 scope 過濾 rows 再聚合（即現有 routes 內 scope 邏輯）。

**Scorecard**

- 此 API **沒有** scope 參數（只有 `groupBy=product` | `person`）。  
- 有預計算：依 `groupBy` 回傳 `precomputedScorecard.product` 或 `.person`。  
- 無預計算：走 fallback，即時算整批 ROI/scorecard（無 scope 維度）。

---

## 快速對照表

| API | 路徑 | computeRoiFunnel | computeScaleReadiness | 整批 campaign regex 聚合 |
|-----|------|------------------|------------------------|---------------------------|
| action-center | precomputed（scoped / unscoped） | 否 | 否 | 否 |
| action-center | fallback | 否 | 是 | 是 |
| scorecard | precomputed | 否 | 否 | 否 |
| scorecard | fallback | 是 | 否 | 是（toRoiRows + parse） |

依上表，在本地或測試比對 **response headers**（`X-ActionCenter-Path`、`X-Scorecard-Path`）即可確認當前請求走的是預計算或 fallback，並對應到上列是否執行重型函式與聚合。

---

## 用 curl 檢查 headers（範例）

登入後取得 session cookie，再對 API 只取 headers 比對路徑：

```bash
# 假設服務在 http://localhost:5000，且已登入（替換為你的 cookie）
curl -sI -b "connect.sid=YOUR_SESSION_COOKIE" "http://localhost:5000/api/dashboard/action-center"
# 看 X-ActionCenter-Path、X-ActionCenter-Scoped

curl -sI -b "connect.sid=YOUR_SESSION_COOKIE" "http://localhost:5000/api/dashboard/action-center?scopeProducts=某商品"
# scoped 時 X-ActionCenter-Scoped: yes，仍為 precomputed 時不會重算

curl -sI -b "connect.sid=YOUR_SESSION_COOKIE" "http://localhost:5000/api/dashboard/scorecard"
curl -sI -b "connect.sid=YOUR_SESSION_COOKIE" "http://localhost:5000/api/dashboard/scorecard?groupBy=person"
# 看 X-Scorecard-Path
```

---

## 七、實際驗證回報格式（階段一驗收用）

完成上述驗證後，請依下列格式回報（可貼於本文件或另存）。

### 1. 實際驗證過的情境列表

- [ ] action-center unscoped（precomputed vs fallback）
- [ ] action-center scopeAccountIds（scoped precomputed vs scoped fallback）
- [ ] action-center scopeProducts（scoped precomputed vs scoped fallback）
- [ ] scorecard product（precomputed vs fallback）
- [ ] scorecard groupBy=person（precomputed vs fallback）
- [ ] 持久化：有 version 必有完整 payload；無假完成
- [ ] 路徑：新 refresh batch 走 precomputed；fallback 僅舊 batch／預計算失敗

### 2. 每個情境的 header 結果（範例）

| 情境 | X-ActionCenter-Path / X-Scorecard-Path | X-ActionCenter-Scoped |
|------|----------------------------------------|------------------------|
| GET /api/dashboard/action-center | precomputed | no |
| GET ...?scopeAccountIds=... | precomputed | yes |
| GET ...?scopeProducts=... | precomputed | yes |
| GET /api/dashboard/scorecard | precomputed | — |
| GET /api/dashboard/scorecard?groupBy=person | precomputed | — |

### 3. precomputed vs fallback 是否一致

- 執行 `npm run verify:precompute:consistency` 結果：通過 / 失敗（若失敗請列出差異）。
- 若有允許的微小差異，請列出原因。

### 4. 已知不一致或殘留重型路徑

- 若無則填「無」。
- 若有，請說明情境與是否已修正或標記。

### 5. 為驗證而新增或修改的檔案

- `script/verify-precompute-consistency.ts`（新增；無 precomputed 時預設 exit 1，`--allow-missing-precomputed` 寬鬆；含 response 契約檢查）
- `script/verify-precompute-persistence.ts`（新增；完整性保護 + 部分污染檢查）
- `script/verify-precompute-headers.ts`（新增；實際打 5 支 API 驗證 path header）
- `server/precompute-metrics.ts`（新增；fallback counter + structured log）
- `server/routes.ts`（預計算用區域變數再寫入 batch；fallback 時呼叫 metrics；`GET /api/debug/precompute-stats`）
- `package.json`（新增 `verify:precompute`、`verify:precompute:persistence`、`verify:precompute:consistency`、`verify:precompute:headers`）
- `docs/precompute-path-verification.md`（本文件）
- `docs/campaign-parse-cache.md`（campaignParseCache 治理說明）

---

---

## 九、階段一驗收結論（最終版）

**階段一已完成驗收。**

- **根因與修正**：重啟後 5 支 API 曾回傳 `empty`，原因為 persisted 檔僅存 scope 鍵（如 `1::all::7:...`），未存 `userId` 鍵（如 `"1"`），故 `getLatestBatch(userId)` 取不到 batch。已在 **`server/storage.ts`** 的 **`loadPersistedData()`** 中補上依 **`batch.userId`** 回建索引：對每個 userId 選一筆作為「latest」寫入 `batchStore`，使重啟後 `getLatestBatch(userId)` 仍能回傳該使用者的 batch（且依下方規則優先具 precomputed 者）。
- **實測結果**：重啟服務後，5 支核心 API（action-center 無 scope / scopeAccountIds / scopeProducts、scorecard / scorecard?groupBy=person）實測皆為 **precomputed**，無 fallback、無 empty。
- **其餘成果**：預計算與 fallback 關鍵輸出一致、契約檢查、完整性保護、防半成品污染、fallback 可觀測性與 cache 治理均已完成並驗收。

### 同一 userId 多個 batch 時，「latest」選取規則

載入 `.data/latest-batch.json` 時，同一 `userId` 若對應多筆 batch，**作為該 userId 的 latest（供 `getLatestBatch(userId)` 使用）** 的排序規則為：

1. **優先具預計算**：`precomputedActionCenter` 與 `precomputedScorecard` 皆存在者優先於任缺其一者。
2. **同為有／無預計算時**：以 **`precomputeCompletedAt`** 較新者為準（字串比較，大者為新）。
3. **再相同**：以 **`generatedAt`** 較新者為準（字串比較，大者為新）。

實作位置：`server/storage.ts` 的 `loadPersistedData()` 內，建立 `byUserId` 時依上述規則挑選每 userId 一筆 batch，再對尚未存在 `batchStore.has(uid)` 的 userId 寫入。

---

## 十、階段二範圍（接續）

階段一驗收完成後，接續 **階段二**，範圍依 `docs/refactor-inventory-report.md` §5：

- **POST /api/refresh**：改為回傳 `jobId`；**GET /api/refresh/status** 或 **GET /api/refresh/:jobId/status** 可查單一 job。
- **Refresh job 狀態持久化**：`server/storage.ts` 或新檔（如 `.data/refresh-jobs.json`）存 jobId、userId、scopeKey、status、createdAt、completedAt、error 等。
- **Refresh 執行端**：改為可追蹤 job、**原子切換最新成功 batch**（僅在 refresh 完全成功後才更新該 userId/scope 的 latest batch）。

細節與其餘階段見 `docs/refactor-inventory-report.md`。

---

## 十一、階段一 E2E 實跑驗收結果（範本）

以下為一次實際執行結果，供對照。

### 1. 產生具 precomputed 的 batch

- 執行 `npx tsx script/backfill-precompute.ts`（因環境未跑完整 refresh，以 backfill 對既有 batch 寫入預計算）。
- 結果：6 個 batch 具 precomputedActionCenter / precomputedScorecard，並寫入 `userId` 鍵供 `getLatestBatch(userId)` 使用。

### 2. `npm run verify:precompute` 實際輸出

```
=== 預計算完整性保護檢查 ===
已檢查 12 個 batch，其中 6 個具 precompute 標記且結構完整。
完整性保護檢查通過：無假完成、無部分污染、無 payload 結構不完整。
=== 預計算結果一致性驗證 ===
[OK] action-center unscoped (...): 契約與關鍵值一致
[OK] action-center scopeAccountIds (...): 契約一致（scoped 數量因 filter/build 邊界可略異，僅驗契約）
[OK] action-center scopeProducts (...): 契約一致（…）
[OK] scorecard (...): 契約與關鍵值一致
（共 6 個 batch × 4 類情境）
全部情境：precomputed 與 fallback 關鍵輸出一致。
```

- **verify:precompute**：全通過。

### 3. `npm run verify:precompute:headers` 說明

- 需服務已啟動且已登入（`PRECOMPUTE_TEST_USER` / `PRECOMPUTE_TEST_PASSWORD` 或 `PRECOMPUTE_TEST_COOKIE`）。
- 驗收通過時腳本輸出：**「全部 5 支 API 的 path 實測均為 precomputed，無 fallback，亦無 empty。」**
- 若任一為 **fallback** 或 **empty**（且應有 batch 時）：腳本 exit 1；可檢查服務是否已重啟、登入是否正確、storage 是否已載入具 precomputed 的 batch。

### 4. 重啟後持久化與 path 驗證

- 重啟服務後再次執行 `npm run verify:precompute:persistence`：應仍通過（檔案 `.data/latest-batch.json` 含預計算欄位）。
- 重啟後執行 `npm run verify:precompute:headers`（登入同上）：實測 5 支 API 皆為 **precomputed**（storage 載入時會以 userId fallback 填入具 precomputed 的 batch）。

### 5. `/api/debug/precompute-stats` 防護

- **有** dev / env guard：僅在 **NODE_ENV=development** 或 **ENABLE_DEBUG_PRECOMPUTE_STATS=1**（或 `true`）時回傳 200 + JSON；否則回傳 **404**，不裸露 debug 路由。

### 6. Fallback counter 與重啟

- Counter 為 in-memory（`server/precompute-metrics.ts`），**重啟後歸零**。
- 重啟前若未曾打過 fallback，則 counter 為 0；重啟後打 precomputed path，counter 仍為 0，符合預期。

### 7. 新 refresh batch 是否仍會走 fallback

- **不會**。新 refresh 成功後會寫入兩份 precomputed，之後 GET 一律走 precomputed。僅**舊 batch（無預計算）**或**該次 refresh 預計算失敗**時會走 fallback。

### 8. 後續建議：真正 refresh 全鏈路驗證

本階段已以 backfill 與 API 實測完成預計算讀路徑驗收。**後續若環境具備完整外部 token**（Meta / GA4 等），建議再補一次**真正 `/api/refresh` 成功後的全鏈路驗證**：refresh 完成後依序執行 `npm run verify:precompute` 與 `npm run verify:precompute:headers`，確認預計算由 refresh 管線寫入且 5 支 API 仍回傳 precomputed。

---

## 十二、campaignParseCache 治理

- **用途**：`parseCampaignNameToTags` 的 in-memory cache，避免同一批 campaign 名稱重複 regex 解析。
- **Key 正規化**：`normalizeCacheKey(name)`（`shared/tag-aggregation-engine.ts`）：`trim()`、空白壓成單一空格、`\u00A0` 換成空格。
- **上限與淘汰**：`CACHE_MAX_SIZE = 10000`；超過時 `evictCacheIfNeeded()` 刪除前半 keys，避免無限制成長。
- **清空時機**：**refresh 開始時**在 `server/routes.ts` 呼叫 `clearCampaignParseCache()`（約 L1432），避免長期累積；測試或需控管時可手動呼叫。
- **觀測**：`getCampaignParseCacheSize()` 匯出供觀測目前 size。
- **長期記憶體風險**：有上限與淘汰，且 refresh 時清空，長期記憶體成長有保護。詳見 `docs/campaign-parse-cache.md`。
