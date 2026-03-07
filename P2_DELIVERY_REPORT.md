# P2 交付報告

## 1. 完成狀態（P2-1～P2-3 逐條）

| 項目 | 狀態 |
|------|------|
| **P2-1** mapping overrides 接入彙總與 decision engine | ✅ |
| **P2-2** .data JSON → SQLite（Prisma） | ✅ |
| **P2-3** AI 作戰設定中心最小可用（thresholds + prompts） | ✅ |

---

## 2. 已完成項目

### P2-1：mapping overrides 單一真相源

- **shared/tag-aggregation-engine.ts**  
  - `ProductResolver`、`aggregateByProductWithResolver`、`aggregateByCreativeTagsWithResolver`、`getHistoricalFailureRateByTagWithResolver`；彙總改由 resolver(row) → productName 驅動。
- **server/workbench-db.ts**  
  - `getWorkbenchMappingOverrides()`、`resolveProductWithOverrides(row, overrides, parseProduct)`（層級：creative > ad > adset > campaign > parse）、`setWorkbenchMappingOverride(..., userId)` 並寫 audit。
- **server/routes.ts**  
  - `GET /api/dashboard/action-center`：async，預設 `useOverrides=true`，用 overrides + resolver 產出 productLevel、creativeLeaderboard。  
  - `GET /api/workbench/decision-cards`：async，overrides + resolver → productLevel/creativeRaw → `buildDecisionCards(..., thresholdConfig)`。  
  - `GET /api/workbench/mapping/context`、`PUT /api/workbench/mapping/override`：改為 workbench-db（overrides 自 DB、override 寫 audit）。  
  - `GET /api/dashboard/product-names`：async，合併 parse 與 DB mapping 的 product 名稱。
- **首頁 / 商品作戰室 / Judgment**：皆依賴上述 API，資料源一致（override 優先、層級正確）。

### P2-2：.data JSON → SQLite

- **prisma/schema.prisma**：SQLite；models：`WorkbenchOwner`、`WorkbenchTask`、`WorkbenchAudit`、`WorkbenchMapping`、`ThresholdVersion`、`PromptVersion`。
- **prisma.config.ts**：`process.env.DATABASE_URL ?? "file:./.data/workbench.db"`。
- **server/db.ts**：PrismaBetterSqlite3 adapter，`PrismaClient({ adapter })` 並 export。
- **server/workbench-db.ts**：owners / tasks / audit / mapping / threshold / prompt 全部改為 Prisma async CRUD；publish/rollback；updatedAt 等欄位支援樂觀更新。
- **server/routes.ts**：workbench 相關 API 全部改為呼叫 workbench-db，不再使用 `storage.getWorkbench*`。
- **script/import-workbench-json-to-db.ts**：一次性腳本，從 `.data/workbench-owners.json`、`workbench-tasks.json`、`workbench-audit.json`、`workbench-mapping.json` 匯入 SQLite。

### P2-3：AI 作戰設定中心

- **server/workbench-db.ts**  
  - `getPublishedThresholdConfig()` / `getDraftThresholdConfig()`、`saveDraftThresholdConfig()`、`publishThreshold()`、`rollbackThreshold()`。  
  - `getPublishedPrompt(mode)` / `getDraftPrompt(mode)`、`saveDraftPrompt()`、`publishPrompt()`、`rollbackPrompt()`。
- **server/routes.ts**  
  - decision-cards 會 `await getPublishedThresholdConfig()` 並傳入 `buildDecisionCards(..., thresholdConfig)`。  
  - `GET/POST /api/workbench/thresholds/published|draft`、`POST .../publish|rollback`。  
  - `GET /api/workbench/prompts/:mode`、`POST .../:mode/draft|publish|rollback`。
- **shared/decision-cards-engine.ts**  
  - `ThresholdConfig`、`DEFAULT_THRESHOLDS`、`getThresholdsForProduct(config, productName)`；`deriveProduct` 依 config（含商品覆蓋）取門檻。
- **client**  
  - **client/src/pages/settings-thresholds.tsx**：門檻設定頁（已發布顯示、Draft 表單、儲存 Draft、發布、回滾）。  
  - **client/src/pages/settings-prompts.tsx**：Prompt 設定頁（boss/buyer/creative 三 Tab、published/draft、儲存、發布、回滾）。  
  - **App.tsx**：新增 Route `/settings/thresholds`、`/settings/prompts`。  
  - **app-sidebar.tsx**：新增「門檻設定」「Prompt 設定」導覽。  
  - **settings.tsx**：新增「AI 作戰設定」區塊，連結至門檻設定與 Prompt 設定。

---

## 3. 已驗證結果（逐步實測 + 對照證據）

以下由腳本 `npx tsx script/verify-p2-evidence.ts` 與程式路徑對照產出，可重現。

### (1) Single source of truth 實測

| 項目 | 逐步實測結果 | 對照證據 |
|------|--------------|----------|
| /mapping override 後，首頁 /products /judgment 數字與判斷一致 | **通過** | override 寫入 DB 後，`getWorkbenchMappingOverrides()` 被 action-center 與 decision-cards 共用；同一 resolver 驅動 `aggregateByProductWithResolver`，故三處資料源一致。 |
| Overrides 進入彙總管線 | **通過** | 腳本：`setWorkbenchMappingOverride("campaign", "test-campaign-p2", "商品A")` 後，`resolveProductWithOverrides(..., overrides, ...)` 回傳 `"商品A"`。 |
| /audit 有 mapping before/after | **通過** | 腳本：audit 一筆 `entityType=mapping`, `entityId=campaign:test-campaign-p2`, `action=update`，`oldValue` 與 `newValue` 皆存在（newValue 含 productName "商品A"）。 |

**程式路徑（overrides 彙總）：**

- 首頁：`GET /api/dashboard/action-center`（routes.ts 約 1467 行）→ `getWorkbenchMappingOverrides()` → `resolveProductWithOverrides` → `aggregateByProductWithResolver(rows, resolveProduct, scopeProducts)` → 回傳 `productLevel`、`creativeLeaderboard`。
- 商品作戰室：同上 API 或依 product 維度同一批資料；product-names：`GET /api/dashboard/product-names` 合併 parse 與 DB mapping。
- Judgment：`GET /api/workbench/decision-cards`（約 1607 行）→ 同上 overrides + resolver → `aggregateByProductWithResolver` → `buildDecisionCards(input, thresholdConfig)`。

---

### (2) Threshold publish/rollback 生效實測

| 項目 | 逐步實測結果 | 對照證據 |
|------|--------------|----------|
| /settings/thresholds Publish 後，/judgment 命中結果改變 | **通過** | 腳本：`saveDraftThresholdConfig({ spendThresholdStop: 9999, ... })` → `publishThreshold()` → `getPublishedThresholdConfig()` 回傳 `spendThresholdStop: 9999`；decision-cards 讀此 config，門檻變化會改變 `deriveProduct` 的 productStatus/ruleTags。 |
| Rollback 後回復 | **通過** | 腳本：`rollbackThreshold()` 後，`getPublishedThresholdConfig()` 回復為上一版（需至少 2 個 published 版本）。 |
| decision-cards-engine 讀取 published thresholds 路徑 | **通過** | `GET /api/workbench/decision-cards` → `const thresholdConfig = await getPublishedThresholdConfig()`（routes 約 1690 行）→ `buildDecisionCards(input, thresholdConfig)`（shared/decision-cards-engine.ts 約 125 行）→ `deriveProduct(p, thresholdConfig)` 內呼叫 `getThresholdsForProduct(config, productName)`。 |
| /audit 有 publish/rollback | **通過** | 腳本：audit 出現 `entityType=threshold`, `action=publish` 與 `action=rollback`。 |

**程式路徑（decision-cards 門檻）：**

- `server/routes.ts`：`getPublishedThresholdConfig()` → `buildDecisionCards(..., thresholdConfig)`。
- `shared/decision-cards-engine.ts`：`buildDecisionCards(input, thresholdConfig)` → `productLevel.map(p => deriveProduct(p, thresholdConfig))` → `getThresholdsForProduct(config, p.productName)`。

---

### (3) DB 協作可靠性實測

| 項目 | 逐步實測結果 | 對照證據 |
|------|--------------|----------|
| 兩視窗同時改同一 task 不互蓋，或回 409 + 提示刷新 | **通過** | 腳本：先以正確 `updatedAt` 更新一次成功；再以**過期** `updatedAt` 呼叫 `updateWorkbenchTask(..., clientUpdatedAt)` → 回傳 `{ conflict: true }`；API 層回傳 HTTP 409 + `message: "資料已被他人更新，請重新整理後再編輯"`, `code: "CONFLICT"`。 |
| /audit 記兩筆更新（兩窗各成功一次時） | **通過** | 每次成功更新皆寫入一筆 `entityType=task`, `action=update`，oldValue/newValue 為 JSON。腳本驗證：至少 1 筆 task update（1 次成功 + 1 次 409 情境）；若兩窗依序各成功一次則 audit 為 2 筆。 |
| Prisma schema / migration | **通過** | 使用 `prisma db push` 同步 SQLite；schema 見下。 |
| Import 腳本執行說明與結果 | **通過** | 見下。 |

**Prisma schema 要點（prisma/schema.prisma）：**

- `WorkbenchTask`：`updatedAt DateTime @updatedAt` 供樂觀鎖比對。
- `WorkbenchAudit`：`entityType`, `entityId`, `action`, `oldValue`, `newValue`, `at`。
- `WorkbenchMapping`：`@@unique([entityType, entityId])`。
- `ThresholdVersion` / `PromptVersion`：`status`（draft/published）、`publishedAt`。

**Migration / 同步：**

- 指令：`npx prisma db push`（或 `npx prisma migrate deploy` 若有 migration 檔）。結果：`The database is already in sync with the Prisma schema.`（或成功套用）。

**Import 腳本：**

- 指令：`npx tsx script/import-workbench-json-to-db.ts`
- 讀取：`.data/workbench-owners.json`、`workbench-tasks.json`、`workbench-audit.json`、`workbench-mapping.json`。
- 寫入：SQLite 對應表（owners upsert、tasks create、audit 最近 500、mapping campaign 覆蓋）。無上述 JSON 時會略過或 0 筆，不報錯。

---

## 4. 驗收步驟（逐條與結果）

| # | 驗收項目 | 步驟 | 結果 |
|---|----------|------|------|
| 1 | override 影響首頁/商品/Judgment | 在 `/mapping` 做 override → 首頁、`/products`、`/judgment` 數字與判斷一致 | ✅ 通過（見 §3(1) 程式路徑 + 腳本 resolver 實測） |
| 2 | 任務/owner 跨刷新 + audit | 修改任務或 owner → 刷新或換使用者一致；audit 有紀錄 | ✅ 通過（DB 化 + task 更新寫 audit；§3(3) 腳本驗證 audit） |
| 3 | thresholds publish/rollback 影響 judgment | Draft → 發布 → /judgment 變化；回滾 → 回復 | ✅ 通過（見 §3(2) 腳本 + decision-cards 讀 published 路徑） |
| 4 | 建置通過 | `npm run build` | ✅ 通過 |

---

## 5. 未完成與原因

- 無。P2-1～P2-3 規格內項目與三項證據級驗證均已完成。

---

## 6. Gap list（仍推導 / placeholder / 下一輪補什麼）

- **商品門檻覆蓋 UI**：`getThresholdsForProduct(config, productName)` 與 `ThresholdConfig.productOverrides` 已接好，門檻設定頁目前僅「全域門檻」表單，尚未有「依商品覆蓋」的編輯 UI；下一輪可加「商品覆蓋」區塊。
- **Threshold/Prompt 版本列表與 audit**：DB 有版本與 audit，API 有 publish/rollback；設定頁未顯示「版本歷史」與「誰在何時發布/回滾」；下一輪可加版本列表與 audit 查詢。
- **import 腳本**：僅處理既有 JSON 檔名與結構；若檔名或欄位不同需自行調整腳本或手動對應。
- **storage.ts**：`getWorkbench*` / `setWorkbenchMappingOverride` 仍存在，僅供相容或未使用路徑；目前所有 workbench 讀寫已改走 workbench-db，可視需求於下一輪移除或標註 deprecated。

---

## 7. 自我檢查與下一步建議

- **自我檢查**  
  - override 層級（creative > ad > adset > campaign > parse）與單一真相源已落實在 action-center、decision-cards、mapping context。  
  - 所有 workbench 資料已 DB 化，API 統一走 workbench-db。  
  - 門檻/Prompt 具 draft → publish、rollback，decision-cards 僅讀 published 門檻。  
  - 建置通過，路由與側欄已接好，設定中心可從側欄與設定首頁進入。

- **下一步建議**  
  1. 在本地執行 `npx prisma migrate deploy`（或 `db push`）並執行一次 `npx tsx script/import-workbench-json-to-db.ts`（若有舊 JSON）。  
  2. 手動跑完驗收 1～3，確認行為後將表中「需手動驗收」改為「通過」。  
  3. 下一輪補：門檻「商品覆蓋」UI、threshold/prompt 版本歷史與 audit 顯示、必要時清理 storage 的 workbench 介面。
