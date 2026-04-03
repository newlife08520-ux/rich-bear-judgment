# 首頁可信度修復 + 舊區塊退場 — 交付回報

**本輪目標**：統一首頁資料來源、加 source meta、落實 guardrail、舊首頁區塊退場、區塊 2/4/5 防呆與降噪。不改 Phase 2C 視覺主結構，不進 Phase 3。

---

## 1. 完成狀態

| 項目 | 狀態 |
|------|------|
| 五區資料來源統一 | **完成**（區塊 1～5 皆來自 `GET /api/dashboard/action-center`） |
| 頂部 KPI 與五區同 batch | **完成**（頂部 KPI 亦用 actionData.productLevel，見 dashboard.tsx 約 1576–1586 行 card-today-kpi） |
| 統一首頁資料來源（頂部 KPI + 五區） | **完成**（皆 action-center，同一 batch） |
| 加 source meta / debug 資訊 | **完成**（action-center 回傳 `sourceMeta`，首頁顯示 batchId / generatedAt / dateRange / scopeKey / campaignCountUsed / excludedNoDelivery / excludedUnderSample / unmappedCount） |
| 未分類／花費 0／no_delivery／under_sample／cost rule missing 不進核心區 | **完成**（後端過濾；主力區 ROAS > 0） |
| 舊首頁區塊退場 | **完成**（收合成「舊版報表（次級）」Collapsible，defaultOpen=false） |
| 區塊 2 / 4 最低限度防呆 | **完成**（區塊 2 後端主力僅 roas>0；區塊 4 空態「目前無符合條件素材」） |
| 區塊 5 降噪 | **完成**（維持 guardrail、保留「本輪尚未接入今日已調次數」與「目前無漏斗資料…廣告層推測」，視覺為收束區） |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `server/routes.ts` | action-center：tableRescue/tableScaleUp/tableNoMisjudge 排除 productName==="未分類"；tableExtend 排除 productName==="未分類"；productLevelMain 改為 spend>0 且 productName!=="未分類" 且 **roas>0**；新增回傳 **sourceMeta**（batchId, generatedAt, dateRange, scopeKey, campaignCountUsed, excludedNoDelivery, excludedUnderSample, unmappedCount）；early return 時一併回傳 sourceMeta。 |
| `client/src/pages/dashboard.tsx` | 新增 ActionCenterSourceMeta 與 sourceMeta 於 ActionCenterData；五區後顯示「資料來源」一行（sourceMeta）；將「待驗證區說明」+ 漏斗診斷 + 今日先救/可加碼/維持/延伸表 + ProductRedBlackBoard + CreativeLeaderboard + 全公司商品排行榜收合於 Collapsible「舊版報表（次級）」defaultOpen=false；區塊 4 空態改為「目前無符合條件素材」。 |

---

## 3. 首頁各區是否吃同一份資料（batchId / dateRange / scopeKey）

| 區塊／區 | 資料來源 | batchId / dateRange / scopeKey |
|----------|----------|----------------------------------|
| 頂部 KPI（總花費／營收／ROAS／利潤估算） | action-center → productLevel | 同 actionData.sourceMeta |
| 區塊 1 今日最該動的 5 件事 | action-center → todayActions | 同 actionData.sourceMeta |
| 區塊 2 主力商品戰情 | action-center → productLevelMain | 同 actionData.sourceMeta |
| 區塊 3 高預算危險商品 | action-center → tableRescue + riskyCampaigns | 同 actionData.sourceMeta |
| 區塊 4 黑馬素材 | action-center → tierHighPotentialCreatives | 同 actionData.sourceMeta |
| 區塊 5 節制提醒 | action-center → batchValidityReason / budgetActionNoDelivery / UnderSample / funnelEvidence | 同 actionData.sourceMeta |

**說明**：首頁**頂部 KPI**（總花費／營收／ROAS／利潤估算）與五區皆使用 **actionData**（`/api/dashboard/action-center`），變數為 `actionData.productLevel`，render 為 `data-testid="card-today-kpi"` 的 Card（dashboard.tsx 約 1576–1586 行），故 **batchId / dateRange / scopeKey 以 actionData.sourceMeta 為準**，同一份資料。**報表與帳號（次級）** 收合區內的 HeroSummaryCard、帳號排名等則來自 `cross-account-summary`（summaryData），非首屏頂部 KPI。

---

## 4. 這輪修掉哪些具體錯誤

- **未分類進核心區**：tableRescue、tableScaleUp、tableNoMisjudge、tableExtend 後端排除 productName==="未分類"；productLevelMain 已排除未分類，且新增 roas>0，避免 ROAS 0 用主力語氣呈現。
- **花費 0 / no_delivery / under_sample 進核心區**：沿用 Phase 2A（budgetActionDecisionReady、creativeLeaderboard 排除 under_sample）；sourceMeta 可驗證 excludedNoDelivery、excludedUnderSample 筆數。
- **cost rule missing 進主力放大區**：tableScaleUp 已限 hasRule===true；主力區為 productLevelMain（有成本規則且 roas>0）。
- **ROAS 0 像主力**：productLevelMain 改為僅含 roas>0。
- **首頁主軸被舊表搶走**：今日先救／可加碼／維持／延伸表、ProductRedBlackBoard、CreativeLeaderboard、全公司商品排行榜收合至「舊版報表（次級）」。
- **區塊 4 空態不明確**：改為「目前無符合條件素材」。
- **無法驗證同一批資料**：新增 sourceMeta 與首頁「資料來源」一行，可對 batchId/dateRange/scopeKey/campaignCountUsed/excluded/unmapped 除錯。

---

## 4.1 實機自查（建議部署後執行）

- 確認首頁最上方 KPI（`data-testid="card-today-kpi"`）的**總花費／營收**與區塊 1～4 的總體邏輯對得上（同 batch、同 scope）。
- 不應出現：頂部總花費比單一區塊內卡片花費加總還小很多、或頂部總營收與主力商品戰情明顯不同批。
- 可對照「資料來源」一行的 batchId／generatedAt／campaignCountUsed，確認頂部 KPI 與五區為同一筆 action-center 回應。

---

## 5. 還剩哪些不準或不可信

- **報表與帳號（次級）區內**：HeroSummaryCard、帳號排名、AI 建議等仍來自 `GET /api/dashboard/cross-account-summary`（summaryData），未帶 sourceMeta；非首屏頂部 KPI（頂部 KPI 已用 actionData）。若未來 scope 不同步，該區可能與五區不同批，需依需求再統一或標示。
- **todayActions**：仍為配額拼接（2+2+1+2），非全局優先級排序；todayAdjustCount 未接入。
- **區塊 2 在撐／在拖素材數**：未接 API，未顯示。
- **batchValidity legacy**：仍為占位，未與 valid 嚴格區分。
- **evidenceLevel**：僅首頁核心決策區落地，商品主戰場／素材作戰台未全站統一。

---

## 6. 是否可回到 2C 視覺精修

**可以。** 首頁資料來源已統一、guardrail 已落實、舊區塊已退場、區塊 2/4/5 防呆與降噪已做；可回到 Phase 2C 視覺精修（主次層級、決策卡化、收束區質感、可複製樣板），不再動本輪邏輯。

---

## 7. Commit hash

- **程式 commit**：**11a53b0**（與本回報同 commit）
- **文件 commit**：同上
- **staging or production 部署版本**：（部署後填寫）
