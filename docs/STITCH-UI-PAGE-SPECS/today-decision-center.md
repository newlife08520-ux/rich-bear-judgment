# 今日決策中心（首頁）

## 1. 頁面用途

- **在做什麼**：在單一頁匯總「今日行動、商品概況、Pareto、預算雷達、素材狀態、資料健康」，並承載政策可見性、沉睡名單、partial_data 與 batch 有效性等狀態說明。
- **主要給誰**：老闆、投手、營運（與設定頁「角色工作流」建議一致）。
- **情境**：每日開機先看全店狀態，再決定是否同步資料或下鑽到商品／預算／審判。

## 2. 進入方式

- **route**：`/`。
- **從哪裡來**：側欄「今日決策中心」、登入後預設、設定導覽連結。
- **前置條件**：需登入；資料依 scope 與 action-center／summary API。**路由級權限**：無（**待確認** API）。

## 3. 首屏必須看到的內容

1. **頁首**：`SidebarTrigger`、標題「今日決策中心」、（dev 僅）模擬員工 `Select`、最後更新時間、`更新資料` 按鈕、`DateRangeSelector`。
2. **`VisibilityPolicyStrip`**（有資料時）：未投遞／樣本不足計數與政策版本語意。
3. **`DormantGemsSurfaceSection`**（有 `dormantGemCandidates` 時）：沉睡／暫停高潛名單卡。
4. **條件式警告其一**（若命中）：`scopeMismatch` 琥珀卡；`partial_data` 天藍 banner（`banner-homepage-partial-data`）；`coverageNote`；`batchWeak`／`insufficient` 說明。
5. **五區第一區** `TodayActionsSection`：今日最該做的行動列表（垂直流動首個主內容區）。

## 4. 區塊排列順序（上→下）

- **Header 區**：左標題＋dev 選人；右「最後更新」、更新、日期。
- **主內容頂**：`VisibilityPolicyStrip` → `DormantGemsSurfaceSection`。
- **條件 banners**：scope / partial / coverage / batchWeak。
- **主內容「五區」**（`section` `aria-label="今日決策中心五區"`）：  
  1. `TodayActionsSection`  
  2. `ProductProfitOverviewSection`  
  3. `ParetoSummaryCard`  
  4. `BudgetRadarSection`  
  5. `CreativeStatusSection`  
  6. `DataHealthSection`
- **底部**：`Collapsible`「舊版報表（次級）」— 內有導流文案與 `sourceMeta` 除錯列（batchId、scopeKey 等）。

**布局**：單欄全寬（`page-container-fluid`），無左右雙欄。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- **`更新資料`**（`button-refresh`）：觸發同步與刷新；與決策資料新鮮度直接相關—**頁首右側固定**。

### B. 次按鈕（Secondary）

- **無獨立 named 次按鈕於五區內**；五區內連結／操作**待確認**各 widget 內部。

### C. 危險按鈕（Danger）

- 首頁檔案內無顯式 destructive；若子元件有「停止／刪除」**待確認**。

### D. 輔助按鈕（Utility）

- **`SidebarTrigger`**：開合側欄。
- **`CollapsibleTrigger`**「舊版報表」：`ghost` 全寬。

## 6. 篩選 / 控制元件

- **`DateRangeSelector`**：頁首右側，與更新並列—**應留在首屏**。
- **dev `Select` 模擬員工**：僅 `import.meta.env.DEV`。
- 無全頁 tab。

## 7. 狀態資訊 / badge / warning

- **`partial_data`**：天藍 card，含「五區仍由 action-center 驅動」「hasDecisionSignals」—**不可弱化為小字**。
- **`scopeMismatch`**：琥珀—**必顯眼**。
- **`batchWeak` / `insufficient`**：文案差異—**不可合併成一種語氣**。
- **`coverageNote`**：覆蓋度—**有資料時應看見**。
- **政策列**：未投遞／樣本不足數字—**不可在 AI 改版中消失**。

## 8. 可收合但不能消失的區塊

- **「舊版報表（次級）」**：可預設關閉，但**入口與除錯 meta 不可刪**。
- **`DataHealthSection`**：屬五區之一，可內部摺疊**待確認**，但區塊本身不可從頁面移除。

## 9. 此頁最不能被 AI 誤改的地方

- 五區順序與 `TodayActions` 置頂；partial_data 與 hasDecisionSignals 說明；`VisibilityPolicyStrip`；更新＋日期在首屏同一視野。

## 10. Stitch 用摘要

今日決策中心是單欄儀表，首屏要先讓使用者看到「能否信任這份資料」（partial、scope、batch）以及政策列與沉睡名單，再進入今日行動與四張概覽。主按鈕是頁首「更新資料」，日期範圍必須留在旁邊。五區垂直順序固定，不可把資料健康或診斷永久折到「更多」裡看不到。視覺優化應加強警告層級與可掃讀性，而非減少資訊種類。

（約 230 字）
