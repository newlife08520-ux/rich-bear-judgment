# Creative Intelligence

## 1. 頁面用途

- 模式彙總、審判佇列狀態、Pareto／引擎與多面板工作台（CreativeIntelligenceWorkbench）；並列與 action-center 同步的可見性列。
- 主要給投手、營運、老闆。

## 2. 進入方式

- route：`/creative-intelligence`。
- 側欄更多 → Creative Intelligence。

## 3. 首屏必須看到的內容

1. SidebarTrigger 與標題「Creative Intelligence」。
2. VisibilityPolicyStrip 與 DormantGemsSurfaceSection。
3. 載入中列或「審判佇列」卡片（reviewQueue 數字）。
4. 其餘工作台卡片（Pareto、引擎、證據面板等，見 workbench 目錄）。

## 4. 區塊排列順序

- Header → 可見性區 → 條件載入 → data 區多 Card → CreativeIntelligenceWorkbench 內層（待確認子檔完整順序）。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 待確認 workbench 內主要動作（同步、重新整理等）。

### B. 次按鈕（Secondary）

- 待確認各子面板。

### C. 危險按鈕（Danger）

- 待確認是否有寫入或刪除。

### D. 輔助按鈕（Utility）

- 待確認。

## 6. 篩選 / 控制元件

- scope 由 useAppScope 與 employee 帶 query；頁面級 tab 待確認 workbench。

## 7. 狀態資訊 / badge / warning

- Loader2 載入列；審判佇列 pending／failed 等數字應可見。

## 8. 可收合但不能消失的區塊

- 可見性列與 dormant 與他頁一致；佇列狀態不可刪。

## 9. 此頁最不能被 AI 誤改的地方

- 與 Pareto／command layer API 對齊的區塊名稱與順序（待與程式對照補齊）。

## 10. Stitch 用摘要

Creative Intelligence 是高密度工作台：首屏先有標題與全站一致的可見性政策列，再進入載入或審判佇列摘要，其餘為多卡片分析。子面板細節需再對 workbench 原始碼補齊按鈕名。設計時勿移除佇列與政策列；優化應提升分段標題而非合併所有分析為一塊。

（約 180 字）
