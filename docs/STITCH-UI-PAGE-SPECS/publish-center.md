# 投放中心

## 1. 頁面用途

- 建立與管理投放草稿、開啟精靈對話框、檢視執行紀錄；與 Meta 發佈預覽／執行鏈銜接（見 usePublishWorkbench）。
- 主要給投手。

## 2. 進入方式

- route：`/publish`。
- 側欄更多 → 投放中心。（檔名 publish-placeholder 但為完整 PublishPageView）

## 3. 首屏必須看到的內容

1. SidebarTrigger、標題「投放中心」。
2. 「建立投放草稿」與「執行紀錄」並列。
3. 載入中／錯誤／空狀態「尚無投放草稿」或草稿表格。

## 4. 區塊排列順序

- Header → 操作列 → 狀態卡或表格 → PublishWizardDialog 等。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 「建立投放草稿」。

### B. 次按鈕（Secondary）

- 「執行紀錄」outline；列上編輯、複製等（見表格後半，待確認）。

### C. 危險按鈕（Danger）

- Meta 執行經 Publish 相關 Gate（待確認 PublishExecutionGateDialog）。

### D. 輔助按鈕（Utility）

- 圖示 Pencil、Copy、Send 等於列操作（見檔案後半）。

## 6. 篩選 / 控制元件

- 待確認是否有搜尋或狀態 filter。

## 7. 狀態資訊 / badge / warning

- 載入中、載入失敗 destructive、空狀態插圖與說明。

## 8. 可收合但不能消失的區塊

- 建立草稿入口；執行紀錄入口；空狀態引導。

## 9. 此頁最不能被 AI 誤改的地方

- 與 execution 層整合的確認步驟；草稿列表可編輯性。

## 10. Stitch 用摘要

投放中心首屏要有建立草稿與執行紀錄兩個明確入口，再進列表或空狀態。主 CTA 建立草稿。設計應保留表格操作欄位與狀態 badge，勿改成僅卡片牆而難以批次管理草稿。

（約 140 字）
