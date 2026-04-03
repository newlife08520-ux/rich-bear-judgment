# 判讀紀錄

## 1. 頁面用途

- 查詢審判對話紀錄（sessions）與審判報告（reports），支援報告篩選、搜尋、開啟詳情 dialog 與 PDF 匯出（見 workbench）。
- 主要給全角色做稽核與複盤。

## 2. 進入方式

- route：`/history`。
- 設定中心「判讀紀錄」連結；側欄無直接項（待確認是否應加入）。
- 須登入。

## 3. 首屏必須看到的內容

1. 頁首：SidebarTrigger、標題「判讀紀錄」。
2. Tabs：對話紀錄、審判報告（data-testid tabs-history）。
3. 當 tab 為 reports 時：HistoryFiltersBar（類型篩選與搜尋）。

## 4. 區塊排列順序

- Header 內左標題、右 Tabs；reports 時 FiltersBar 同在 header 區第三段。
- 主內容：HistorySessionsTab 或 HistoryReportsTab。
- HistoryReportDialog（條件開啟）。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 開啟／檢視報告、匯出 PDF（在 dialog 或列表列上，待確認 HistoryReportsTab）。

### B. 次按鈕（Secondary）

- Tab 切換。

### C. 危險按鈕（Danger）

- 待確認是否有刪除報告。

### D. 輔助按鈕（Utility）

- 搜尋與類型 filter。

## 6. 篩選 / 控制元件

- typeFilter、searchQuery 僅在 reports tab 顯示於 FiltersBar。

## 7. 狀態資訊 / badge / warning

- 載入中、空列表（待確認各 tab 文案）。

## 8. 可收合但不能消失的區塊

- 兩個 tab 不可減為單一列表而不區分對話與報告。

## 9. 此頁最不能被 AI 誤改的地方

- 與審判官內歷史側欄的功能分工；報告篩選在 reports 模式必達。

## 10. Stitch 用摘要

判讀紀錄是雙 tab 稽核頁：首屏要有標題與「對話紀錄／審判報告」切換；看報告時篩選與搜尋要留在 header 可見。主操作是開啟報告詳情與可能匯出。設計勿把 tab 收到漢堡而讓使用者不知報告在哪；對話與報告語意不可混成單流。

（約 170 字）
