# START_PHASE.md

以下是本輪開工指令。
你必須先讀 `AGENTS.md`、`docs/PHASE-PRODUCT-RESTRUCTURE.md`、`docs/REPORT_TEMPLATE.md`、`docs/constitution/*.md`，再嚴格遵守本輪限制。

---

## 本輪任務

本輪不是直接假設 Batch 1 / Batch 2 已完成，而是要做：

**Batch 2.5 — Truth Reconciliation + Real Landing + Gated Batch 3**

目標分三段，必須依序完成：

### Stage A：Truth Reconciliation（強制先做）
先對照「前述 Batch 1 / Batch 2 完成回報」與目前 repo 實際內容，逐條核對哪些是真的、哪些沒落地、哪些只做一半。

你不能直接相信先前回報；要以 code 為準。

必須產出：
- `docs/BATCH2-RECONCILIATION-REPORT.md`

此報告至少要包含以下欄位：
- claim（回報宣稱項目）
- actual repo state（實際狀態）
- evidence（對應檔案/關鍵字/行數）
- status：`already-landed` / `missing` / `partial` / `fixed-this-round`
- note（補充）

至少要核對以下 claim：
1. sidebar 是否已是 5 主項 + 次導航
2. `/tasks` `/ga4` `/fb-ads` `/creatives` `/products` 頁面標題是否已收斂
3. dashboard 是否已拆成 `client/src/pages/dashboard/` 目錄結構
4. dashboard 是否已只有 5 區主體
5. `select-mock-employee` 是否僅 dev 顯示
6. `verify:batch1` / `verify:batch2` 是否存在於 `package.json`
7. `.agents/START_PHASE.md` 是否不是模板
8. Batch1 宣稱的 scope 帶入是否在 dashboard / products / fb-ads / ga4 真的一致

**未完成 Stage A 前，不可直接開始寫 Batch 3 回報。**

---

### Stage B：Real Landing of Batch 1 + Batch 2（把宣稱真的寫進 repo）

若 Stage A 發現缺口，必須在本輪授權範圍內補齊，讓 repo 真正符合 Phase Product Restructure 藍圖。

#### B-1. 導航與命名收斂
必做：
- `client/src/components/app-sidebar.tsx`
- 主導航只保留 5 項：
  1. 今日決策中心 `/`
  2. 商品中心 `/products`
  3. 素材審判 `/creatives`
  4. 預算控制 `/fb-ads`
  5. 審判官 `/judgment`
- 次導航收斂為一組，至少容納：
  - 漏斗 / 站內證據 `/ga4`
  - 行動紀錄 `/tasks`
  - 發佈 / 素材中心（既有 route 保留，但不與主 5 項並列）
  - 設定
- sidebar footer 不可在正式環境顯示 `模擬：xxx`

頁面標題必須改為：
- `tasks.tsx` → 行動紀錄
- `ga4-analysis.tsx` → 漏斗 / 站內證據
- `fb-ads.tsx` → 預算控制
- `creatives.tsx` → 素材審判
- `products.tsx` → 商品中心
- `judgment.tsx` → 審判官（不要再用 `RICH BEAR 審判官` 當主標）

#### B-2. Scope 一致性補齊
你要重新檢查並補齊以下頁面所有主要 read query：
- `dashboard.tsx`
- `products.tsx`
- `fb-ads.tsx`
- `ga4-analysis.tsx`

規則：
- query request 必須帶目前 `scope.scopeKey`
- React Query `queryKey` 必須含 scope
- refresh 後 invalidate / refetch 不可只打 base key，避免跨 scope 汙染
- 若目前 scope 與資料來源 batch scope 不一致，首頁必須有清楚橫幅

你不能只補一兩支 API；要把該頁主要決策資料來源全部補完。

#### B-3. 首頁真正改成 5 區決策中心
`client/src/pages/dashboard.tsx` 不可再維持 2000+ 行巨頁。

必須拆成：
- `client/src/pages/dashboard.tsx`：只保留 page shell / header / 橫幅 / 5 區入口 / 次級收合
- `client/src/pages/dashboard/useDashboardDecisionCenter.ts`
- `client/src/pages/dashboard/dashboard-types.ts`
- `client/src/pages/dashboard/dashboard-formatters.ts`
- `client/src/pages/dashboard/widgets/TodayActionsSection.tsx`
- `client/src/pages/dashboard/widgets/ProductProfitOverviewSection.tsx`
- `client/src/pages/dashboard/widgets/BudgetRadarSection.tsx`
- `client/src/pages/dashboard/widgets/CreativeStatusSection.tsx`
- `client/src/pages/dashboard/widgets/DataHealthSection.tsx`
- `client/src/pages/dashboard/widgets/index.ts`

首頁主體只允許這 5 區：
1. `section-today-actions`
2. `section-product-profit-overview`
3. `section-budget-radar`
4. `section-creative-status`
5. `section-data-health`

舊首頁區塊不得再佔主視覺：
- hero 報表牆
- 快速開始
- 大型排行榜
- product red/black board
- creative hero / creative blacklist
- 長型 table 牆

若需要保留 debug / 次級資訊，只能放進「舊版報表（次級）」收合區，且不能重新變成首頁主體。

#### B-4. Mock employee 僅 dev 顯示
- 首頁的 mock employee select 只允許在 `import.meta.env.DEV` 為真時渲染
- 非 dev 不可看到 selector
- sidebar footer 非 dev 也不可出現 `模擬：xxx`

#### B-5. Verify 真正落地
必須新增：
- `script/verify-batch1-nav-and-scope.ts`
- `script/verify-batch2-decision-center.ts`

`package.json` 必須新增：
- `verify:batch1`
- `verify:batch2`

`verify:batch1` 至少檢查：
- sidebar 主導航 5 項存在
- 核心頁面標題已收斂
- dashboard / products / fb-ads / ga4 主要 queryKey 含 scope
- mock employee 僅 dev 顯示

`verify:batch2` 至少檢查：
- 首頁 5 區 `data-testid` 存在
- `client/src/pages/dashboard.tsx` 已拆分並引用 `dashboard/`
- `dashboard.tsx` 行數 < 400
- 舊首頁主體區塊不再直接存在於首頁 shell

#### B-6. 真正更新 `.agents/START_PHASE.md`
本輪執行完成後，repo 內的 `.agents/START_PHASE.md` 不能再是模板內容。
要把本輪實際開工指令寫進去，讓下一位接手的人能看出這輪做了什麼。

---

### Stage C：Gated Batch 3 — Judgment giant page split（只有前面真的過了才做）

**只有在以下條件全部成立時，才可以做 Stage C：**
1. `npm run verify:batch1` 通過
2. `npm run verify:batch2` 通過
3. `npm run verify:baseline` 在已安裝依賴的環境通過；若失敗，必須清楚說明是 code error 還是環境缺依賴，不能只寫一句「tsc 不在 PATH」敷衍

滿足上述條件後，繼續做 Judgment 拆分。

#### C-1. judgment.tsx 拆分
目前 `client/src/pages/judgment.tsx` 為 giant page，需拆成：
- `client/src/pages/judgment.tsx`：shell / header / panel layout / route param wiring
- `client/src/pages/judgment/useJudgmentWorkbench.ts`
- `client/src/pages/judgment/judgment-types.ts`
- `client/src/pages/judgment/judgment-formatters.ts`
- `client/src/pages/judgment/widgets/DecisionCardsSection.tsx`
- `client/src/pages/judgment/widgets/HistoryPanel.tsx`
- `client/src/pages/judgment/widgets/ChatComposer.tsx`
- `client/src/pages/judgment/widgets/EvidencePanel.tsx`
- `client/src/pages/judgment/widgets/StarterEmptyState.tsx`
- `client/src/pages/judgment/widgets/index.ts`
- 若有必要：`client/src/pages/judgment/dialogs/*`

要求：
- `judgment.tsx` 主 entry < 400 行
- 不改 API schema / response shape
- 不改 prompt contract / AI output schema
- 不大改商業邏輯，只做 page shell + state 組織 + widgets 拆分 + 文案/入口收斂

#### C-2. Judgment 頁產品化收斂
- 主標題改為 `審判官`
- 副標不要再過度品牌化，改成更直接的產品語言
- 與首頁 / 商品 / 素材頁的語氣需對齊 `docs/constitution/persona-constitution.md`
- decision cards / evidence / chat 三塊邏輯清楚分區

#### C-3. verify:batch3-judgment
新增 `script/verify-batch3-judgment-split.ts` 與 `package.json` script：`verify:batch3:judgment`

---

## 本輪允許修改

（略：見原指令 — 含 .agents、sidebar、dashboard、dashboard/*、judgment、各頁標題/scope、verify 腳本、package.json、docs 報告）

---

## 本輪禁止修改

- 不准改 refresh / precompute / retry / upload / recovery 主邏輯
- 不准改 AI judgment schema / prompt contract
- 不准把本輪做成純 UI 假象；所有回報項都必須能在 repo 找到實體檔案
- 不准跳過 Stage A 對帳
- 不准在 Stage A/B 沒過時就直接宣稱 Batch 3 完成

---

## 本輪完成標準

1. `docs/BATCH2-RECONCILIATION-REPORT.md` 已交
2. Batch 1 / Batch 2 宣稱項目已真正落地到 repo
3. `npm run verify:batch1` 通過
4. `npm run verify:batch2` 通過
5. `npm run verify:baseline` 已執行；若失敗，需明確區分環境或 code
6. `client/src/pages/dashboard.tsx` < 400 行
7. `.agents/START_PHASE.md` 已更新為本輪真實指令

若 Stage C 未做，必須明確標示：已完成 Stage A + Stage B，未完成 Stage C，並說明原因。

---

## 本輪回報與交付

- 必交：`docs/BATCH2-RECONCILIATION-REPORT.md`
- 必交：`docs/BATCH2.5-COMPLETION-REPORT.md`（含 verify 結果、ZIP 說明）
- 只有真的做 Stage C 時才交：`docs/BATCH3-JUDGMENT-COMPLETION-REPORT.md`
- 交付：最新專案 ZIP（不含 node_modules/dist/.git）+ docs 內本輪完成報告
- ZIP 命名：`phase-product-restructure-batch2_5-complete-YYYYMMDD-HHMM.zip` 或 `phase-product-restructure-batch3-complete-YYYYMMDD-HHMM.zip`
