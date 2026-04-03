# 預算控制

## 1. 頁面用途

- 在選定 Meta 廣告帳戶與日期範圍下，檢視營運摘要、總監摘要、高風險、機會／停損、素材排行與創意詳情，並於結構／預算 tab 觸發 Meta 操作（經 Execution Gate）。
- 主要給投手、營運。

## 2. 進入方式

- route：`/fb-ads`。
- 側欄主導航「預算控制」。
- 須登入；無資料時顯示「使用步驟」教學卡與「前往設定中心」。

## 3. 首屏必須看到的內容

1. 頁首：SidebarToggle、標題「預算控制」、DateRangeSelector、「執行紀錄」、「更新資料」、搜尋框「搜尋素材...」。
2. AccountManagerPanel（帳戶選擇）與 ParetoCommandLayerStrip。
3. FbAdsGoalPacingBanner（目標節奏）。
4. VisibilityPolicyStrip 與 DormantGemsSurfaceSection。
5. OperationalSummarySection（概覽載入區）。

## 4. 區塊排列順序

- Header 兩行：第一行標題與控制；第二行帳戶面板＋Pareto 條。
- Banner → 可見性列 → 主內容：OperationalSummary → 條件「使用步驟」卡 → DirectorSummary → HighRisk → Opportunity → StopLoss → CreativeOpportunityBoard。
- Tabs：素材排行｜結構分析｜預算建議｜警示與機會；下為對應內容與 CreativeTable 等。
- Overlay：CreativeDetailDialog、ExecutionLogDialog、ExecutionGateDialog（Meta 確認）。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 「更新資料」：與帳戶選擇搭配取得資料；頁首右區。

### B. 次按鈕（Secondary）

- 「執行紀錄」outline；tab 切換；CreativeTable 上「看詳情」類操作（開 CreativeDetailDialog，待確認 label）。

### C. 危險按鈕（Danger）

- Meta 暫停／恢復／預算更新等經 ExecutionGateDialog＋勾選「我已知悉並同意執行上述 Meta 操作」。

### D. 輔助按鈕（Utility）

- 搜尋素材輸入；SidebarTrigger。

## 6. 篩選 / 控制元件

- DateRangeSelector、AccountManagerPanel、搜尋框：皆應在首屏或首屏第二行可見。
- TabsList：data-testid tabs-main。

## 7. 狀態資訊 / badge / warning

- 無總監摘要時的虛線主色教學卡（綁定 FB、選帳戶、更新資料）。
- 各 section loading 狀態（待確認各 widget）。
- 可見性列與 dormant 與他頁一致，不可刪。

## 8. 可收合但不能消失的區塊

- 帳戶選擇列；Goal pacing banner；警示 tab 內容；Execution gate 流程。

## 9. 此頁最不能被 AI 誤改的地方

- 帳戶面板與更新資料同脈絡；Meta gate 不可變一鍵；創意詳情 dialog 觸發路徑。

## 10. Stitch 用摘要

預算控制是重儀表加四個主 tab。首屏必須讓人選對帳戶、日期並能更新資料，再看節奏 banner 與政策列。主 CTA 是更新資料；寫入 Meta 一律經確認對話框。教學空狀態卡在有資料後會消失，但設計新稿時不可假設永遠有資料。視覺優化應維持 tab 與帳戶列可掃，不把警示塞進隱藏選單。

（約 220 字）
