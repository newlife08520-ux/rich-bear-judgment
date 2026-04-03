# 團隊權限

## 1. 頁面用途

- 選擇員工、調整部門、以雙欄 Transfer 分配廣告帳戶與商品；含覆蓋檢查卡片與儲存前 diff 對話框。
- 主要給管理者。

## 2. 進入方式

- route：`/settings/team`。
- 設定中心「團隊權限」連結。

## 3. 首屏必須看到的內容

1. SidebarTrigger、標題「團隊權限」與 Users 圖示。
2. 左欄 256px 員工列表按鈕列。
3. 右欄 TeamCoverageCards 與選中員工 Card（部門 Select、Transfer 列表）。

## 4. 區塊排列順序

- Header → 左右分欄：左員工、右詳情 → TeamSaveDiffDialog。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 儲存（待確認 TeamSettingsPageView 底部 Save）。

### B. 次按鈕（Secondary）

- 帳戶／商品左右移動按鈕。

### C. 危險按鈕（Danger）

- 大範圍覆蓋若無確認則屬風險；實際以 TeamSaveDiffDialog 為準。

### D. 輔助按鈕（Utility）

- Undo2 復原、員工切換 ghost／secondary。

## 6. 篩選 / 控制元件

- accountSearch、productSearch 輸入於 transfer 區（見 workbench）。

## 7. 狀態資訊 / badge / warning

- TeamCoverageCards 呈現覆蓋缺口（待確認文案）。

## 8. 可收合但不能消失的區塊

- 左員工列表與右詳情不可改為單頁 wizard 而無法比對覆蓋。

## 9. 此頁最不能被 AI 誤改的地方

- 儲存前 diff 流程；部門 Select 與 AD／MARKETING 等選項完整。

## 10. Stitch 用摘要

團隊權限是左員工右詳情的設定頁，首屏要能看到員工列表與選中者部門加雙欄分配。主 CTA 是儲存並應保留 diff 確認。視覺勿壓縮 transfer 雙欄為單欄；覆蓋警示需可見。

（約 140 字）
