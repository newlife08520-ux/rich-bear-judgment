# 03 — PRODUCT ARCHITECTURE AND MODULE MAP

## 前端主頁面地圖（wouter）

| 路徑 | 頁面 | 責任摘要 |
|------|------|----------|
| `/` | Dashboard | 今日決策、command panel、truth、dormant、次級營運摺疊 |
| `/judgment` | Judgment | Focus／Operator、Rich Bear 工作台、結構化審判 |
| `/products` | Products | 商品作戰卡、排序、沉睡線索、任務開單 |
| `/fb-ads` | FB Ads | 帳戶／素材／結構／預算／警示、dormant 主帶、Meta gate |
| `/ga4` | GA4 | 漏斗／頁面等分析視圖 |
| `/assets` | Assets | 素材套件、版本、上傳鏈 |
| `/tasks` | Tasks | 任務執行與對齊 |
| `/settings*` | Settings | Token、閾值、prompt、獲利規則、團隊 |
| `/creative-intelligence` | CI | 沉睡主鏡頭、標籤、版本線、Pareto v2 |
| `/publish` | Publish | **Placeholder**（導向說明） |
| `/publish/history` | Publish history | **Placeholder** |
| 其他 | scorecard、history、mapping、creatives、creative-lifecycle | 支援與延伸 |

## 後端模組地圖（摘要）

- **`server/routes.ts`**：仍為 **巨型路由集合**（~2385 行級）；部分 dashboard API 已遷至 `server/routes/dashboard-truth-routes.ts`。  
- **`server/modules/execution/`**：執行層（dry-run／apply／log 等語意）。  
- **`server/modules/publish/`**：publish 相關路由與 foundation。  
- **`server/modules/asset/`**：素材上傳、套件、版本。  
- **`server/workbench-db.ts`、Prisma**：工作台擁有者、任務、mapping、threshold、prompt 版本等。  
- **`server/build-action-center-payload.ts`**：action-center 與 scope／precompute 交界（高風險檔）。  
- **`server/rich-bear-prompt-assembly.ts`**：prompt 組裝順序（憲法級）。

## Route 分類（語意）

- **`/api/dashboard/*`**：首頁、摘要、action-center、scorecard、資料健康等。  
- **`/api/workbench/*`**：任務、owners、mapping。  
- **`/api/meta*`／refresh job**：同步與批次（與 Phase2 驗收強相關）。  
- **`/api/creative-intelligence/*`**：CI 專用 JSON。  
- **Content judgment／asset／publish／execution**：各在 modules 或 routes 區塊註冊。

**技術債**：許多仍從 `routes.ts` 單檔 export；**優先質疑**：新 API 是否又堆疊進 giant file。

## Prisma／DB 模型大圖（`prisma/schema.prisma`）

主要模型類型（**17** 個 `model`）：WorkbenchOwner、WorkbenchTask、WorkbenchAudit、WorkbenchMapping、ThresholdVersion、PromptVersion、ExecutionRun、PublishDraftRecord、PublishLogRecord、CreativeReviewRecord、CreativePatternTag、CreativeExperimentLink、CreativeOutcomeSnapshot、CreativeReviewJob、WorkbenchAdjustDaily 等。

**審查重點**：任務／審查／發佈／調整日誌之間是否有一致的外鍵與狀態機；是否與 UI「看得到但寫不進 DB」脫節。

## 各模組成熟度與風險

| 模組 | Mature | Partial | 技術債／風險 |
|------|--------|---------|----------------|
| Dashboard | ● | 終局 UX | 與 summary partial 一致性 |
| Judgment | ● | 深度證據 | AI 與卡片對齊 |
| Products | ● | — | 排序與 scope |
| FB Ads | ● | 多 tab | Meta gate 錯誤處理 |
| GA4 | ● | 與首頁敘事 | — |
| Assets | ● | — | 上傳安全與清理 |
| Publish | ○ | foundation | **placeholder + 真路由混讀風險** |
| Tasks | ● | 與 execution | — |
| Settings | ● | — | prompt 與校準邊界 |
| CI | ● | 歸因／queue | 版本層級完整度 |

## Giant files / debt 清單（必質疑）

1. `server/routes.ts`  
2. `shared/schema.ts`  
3. `server/build-action-center-payload.ts`（邏輯密集）  
4. `client/src/pages/fb-ads/*`、`dashboard/*`（大元件聚合）

## File map 摘要（給審查者導航）

- **首頁**：`client/src/pages/dashboard.tsx`、`client/src/pages/dashboard/widgets/*`  
- **Judgment**：`client/src/pages/judgment.tsx`、`widgets/*`、`useJudgmentWorkbench.ts`  
- **引擎**：`shared/*-engine.ts`、`shared/visibility-policy.ts`、`shared/homepage-data-truth.ts`  
- **Execution UI**：`client/src/components/ExecutionGateDialog.tsx`、fb-ads `useMetaExecutionGate`
