# 漏斗／站內證據

## 1. 頁面用途

- 依 GA4 資產與日期檢視漏斗、頁面排行、頁面比較與頁面詳情；輔以總監摘要與高風險區塊。
- 主要給投手、營運。

## 2. 進入方式

- route：`/ga4`。
- 側欄「更多」→ 漏斗／站內證據。
- 初次載入可顯示整頁 PageSkeleton。

## 3. 首屏必須看到的內容

1. 標題「漏斗／站內證據」、GA4 資產選擇、日期範圍、更新資料、搜尋頁面。
2. Ga4UpperSections。
3. Ga4AssetDimensionCard。
4. 主 Tabs：漏斗分析、頁面排行、頁面比較。

## 4. 區塊排列順序

- Header 控制列 → UpperSections → 維度卡 → MainTabs → Ga4PageDetailDialog。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 更新資料。

### B. 次按鈕（Secondary）

- 三個主 tab 切換。

### C. 危險按鈕（Danger）

- 本頁無內建 Meta 寫入；其餘待確認子元件。

### D. 輔助按鈕（Utility）

- SidebarTrigger、搜尋輸入。

## 6. 篩選 / 控制元件

- 資產選擇、日期、搜尋應與更新同列或緊鄰首屏。

## 7. 狀態資訊 / badge / warning

- PageSkeleton；高風險與漏斗摘要於 UpperSections。

## 8. 可收合但不能消失的區塊

- 三 tab 語意不可合併成單一報表而無法比較頁面。

## 9. 此頁最不能被 AI 誤改的地方

- 資產加日期加更新的關係；詳情 dialog 觸發。

## 10. Stitch 用摘要

GA4 頁首行應清楚呈現目前資產、區間與更新；下方為摘要與三個分析 tab。主 CTA 是更新資料。桌面版勿把控制全收進圖示選單；載入骨架是合法狀態。視覺優化應讓漏斗與排行切換一眼可辨。

（約 160 字）
