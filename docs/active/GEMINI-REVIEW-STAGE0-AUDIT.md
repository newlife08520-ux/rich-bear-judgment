# GEMINI-REVIEW-STAGE0-AUDIT

**目的**：在撰寫 `docs/gemini-review-pack/` 十份對外審查稿前，固定本 repo **Ground Truth**（2026-04-02 稽核基準）。  
**範圍**：僅「審判官／Rich Bear 決策工作台」本專案，不含外部無關系統。

---

## 1. Phase／ZIP／manifest／canonicality

| 項目 | 實測狀態 |
|------|-----------|
| **phaseLabel**（`REVIEW-PACK-MANIFEST.json`） | `phase-batch15_9-complete` |
| **zipName** | `phase-batch15_9-complete-20260402-2226.zip`（若本機已刪 zip，以 `docs/REVIEW-PACK-MANIFEST.json` 為準；重跑 `npm run create-review-zip:verified` 會更新時間戳） |
| **entryCount**（最後一次封包） | 1025 |
| **generatorVersion**（`script/lib/review-pack-generator-version.mjs`） | **`batch15_9`**（已與 phase 15.9 對齊；舊版曾為 `batch15_8` 已修正） |
| **REVIEW-PACK-CONTENTS.json** | `phaseLabel` 須與 MANIFEST 一致；封包腳本會覆寫 |
| **create-review-zip-verified.txt** | 首行須 `exit=0`；尾段 `--- packaged review zip (canonical) ---` 下一行須為當輪 `zipName` |
| **completionReports** | 併列 `docs/BATCH8.7`–`9.6`、`docs/active/BATCH6.9`–`8.7-9.1`、`docs/active/BATCH15.3`–`15.9`、`docs/archive/BATCH*` 等；以磁碟**實際存在**之 `BATCH*-COMPLETION-REPORT.md` 為 ZIP 強制條目 |

**殘留風險**：manifest 內 `completionReports` 若列到已不存在之路徑，封包前 `listCompletionReportPaths` 只會包「存在」之檔；hygiene 以「ZIP 內含目前 docs 樹所列報告」為準，需與團隊約定是否定期清單同步。

---

## 2. package.json 主驗收鏈（真實狀態）

**交付主鏈（必跑）**

1. `npm run verify:product-restructure` → `verify:ui-core` + `verify:intelligence` + `verify:review-pack-contracts`
2. `npm run verify:release-candidate` → `verify:core-regression` + 上列 + `verify:ops` + `verify:reviewer-trust`
3. `npm run create-review-zip:verified` → `inner:prep`（含 2）+ `capture-verify-full-outputs` → wrap（batch68/73）→ `create-review-zip.mjs` → batch73_1 → `inner:postZip`（batch78、78_1、review-zip-hygiene）

**分層語意**

- `verify:ui-core`：`tsc` + scope／mock／AI contract／rule-alignment 等「產品決策面」守門  
- `verify:intelligence`：ledger／goal pacing copy／Pareto 多層／ambiguous 等腳本  
- `verify:review-pack-contracts`：batch97–102（docs 邊界、首頁 v12、沉睡、Judgment、truth tier、routes／schema 第一刀）  
- `verify:reviewer-trust`：batch96（鏈地圖、別名、inner 入口）  
- `verify:ops`：`verify:precompute` + `verify:baseline`（含 build）  
- `verify:final` → 等同 `verify:release-candidate`  
- `verify:wave:legacy-umbrella` → `verify:full`

**core-regression**：`verify-final-regression.ts` 串 Phase2–5 多腳本 + scope/dashboard/no-mock/ai-contract/rule-alignment（與 ui-core 部分重疊，屬刻意雙重保險）。

---

## 3. docs 邊界（實際）

| 路徑 | 用途 |
|------|------|
| **docs/active/** | 當期契約、VERIFY 鏈地圖、truth／homepage／judgment／dormant 設計、**BATCH15.x** 完成報告、**本 Stage0**、REVIEW-PACK-TRUST-BASELINE |
| **docs/archive/** | 歷史 BATCH 完成報告 + README |
| **docs/** 根 | 審查索引（REVIEW-PACK-*.json）、API／UI／SCREENSHOT 對照、OPEN-ISSUES、DELETE-CANDIDATES、VERIFY-FULL-OUTPUTS、各種 CAPTURES／SCREENSHOTS／SANITIZED-DB-SNAPSHOTS |
| **docs/gemini-review-pack/** | **10 份**給 Gemini 外部審查之濃縮稿（不替代 truth pack 原始檔） |
| **docs/PHASE-PRODUCT-RESTRUCTURE.md** | 補齊 `AGENTS.md` 引用之指標文件（避免死鏈） |

---

## 4. 主頁面模組（前端路由 ↔ 責任）

| 路由 | 元件／備註 |
|------|------------|
| `/` | Dashboard：今日決策中心、command panel v12、truth tier、dormant 表面、次級營運摺疊 |
| `/judgment` | Judgment：Focus／Operator、與 Rich Bear 工作台／結構化輸出銜接 |
| `/products` | 商品中心工作台、filter／排序（含 dormant／revival）、battle card |
| `/fb-ads` | 預算控制、素材／結構／預算／警示 tabs、dormant operational 帶 |
| `/ga4` | GA4 分析頁（漏斗／頁面等） |
| `/assets` | 素材／資產套件版本等 |
| `/publish`、`/publish/history` | **Placeholder 導向**（非完整產品發佈控制台） |
| `/tasks` | 任務工作台 |
| `/settings*` | 閾值、prompt、獲利規則、團隊等 |
| `/creative-intelligence` | CI：沉睡主鏡頭、標籤、時間線、Pareto v2 等 |
| `/creative-lifecycle`、`/creatives`、`/scorecard`、`/history`、`/mapping` | 支援／報表／對照用途（成熟度不一） |

---

## 5. shared engines（高層對照）

| 領域 | 代表路徑（實作） |
|------|------------------|
| Homepage truth | `@shared/homepage-data-truth`、`server/routes/dashboard-truth-routes.ts`（含 cross-account-summary、today-verdict 等） |
| Visibility／dormant | `shared/visibility-policy.ts`、action-center payload 建構 |
| Decision cards | `@shared/decision-cards-engine`、client judgment／dashboard 使用 |
| Goal pacing | `@shared/goal-pacing-engine`、API／UI 敘事 |
| Pareto／command | `@shared` 內 pareto／tag-aggregation、client `ParetoCommandLayerStrip` 等 |
| Scoring／ROI funnel | `scoring-engine`、`analysis-engine`、`test:roi-funnel` |

---

## 6. Execution layer

| 能力 | 狀態（稽核觀點） |
|------|------------------|
| **Dry-run / apply / logs** | `server/modules/execution/`、ExecutionGateDialog、多處 Meta 操作閘門 |
| **Rollback note** | 模型／腳本層有驗收語意；產品 UI 是否一致呈現需逐畫面查 |
| **Meta operator** | pause／resume／budget 等與 `useMetaExecutionGate`、fb-ads tabs 連動 |
| **Publish** | **foundation／placeholder 與 draft 流程並存**；「一鍵上線到 Meta 商業完整闭环」**非**已全部完成 |

---

## 7. Truth pack 目錄角色

| 目錄／檔 | Tier／角色 |
|-----------|------------|
| `PAGE-STATE-SCREENSHOTS/` | 多為 **Tier B** 搭配截圖腳本；v12／v7 檔名已列入 `take-page-state-screenshots.ts` |
| `RUNTIME-QUERY-CAPTURES/` | **Tier B** sample JSON，對照 API 形狀 |
| `LIVE-RUNTIME-CAPTURES/` | 目錄名歷史相容；語意見 `TIER-README.md`（多數 **Tier B**） |
| `SANITIZED-DB-SNAPSHOTS/` | 去識別範例；含 dormant v4、zero-spend classification v2 等 |
| `UI-TRUTH-MAPPING.md`、`SCREENSHOT-TO-DATA-MAP.md`、`API-SAMPLE-PAYLOADS.md` | 對照 UI↔資料；API 範例標 **Tier B** 誠實 |

**Tier C／D**：契約與 placeholder 為主，**不可**當 production 真值。

---

## 8. Open issues／blockers（文件真值）

見 `docs/OPEN-ISSUES-AND-BLOCKERS.md`（精簡列表）；Stage0 補充：**generator／phase 對齊**已處理；**巨型 routes／schema** 仍為主技術債。

---

## 9. 巨大檔案／維護風險（量測）

| 檔案 | 約略行數（PowerShell 量測） |
|------|----------------------------|
| `server/routes.ts` | ~2385 |
| `shared/schema.ts` | ~1757 |

已開始：`dashboard-truth-routes.ts` 抽出部分 dashboard API；`shared/schema/recommendation-level.ts` 第一刀。其餘仍集中於單檔。

---

## 10. Phase drift／sample vs live

- **Zip／manifest／verified log**：以**最後一次成功** `create-review-zip:verified` 為準；換日重跑會改 `zipName` 時間戳。  
- **Seeded／dev**：多數擷取與截圖為 **Tier B**；審查時必讀 tier 標籤。  
- **AGENTS.md**：已補 `docs/PHASE-PRODUCT-RESTRUCTURE.md` 指標，降低「文件引用不存在」漂移。

---

**下一歩**：以上條目為 `docs/gemini-review-pack/01`–`10` 之唯一事實來源；若與舊 completion 報告衝突，**以本 Stage0 + 現行程式 + manifest 為準**。
