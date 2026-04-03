# 商品中心（含「商品詳情」說明）

## 1. 頁面用途

- **在做什麼**：依帳戶／商品 scope 與篩選，檢視商品主表、總覽指標、Pareto 指令層、可見性政策、作戰卡網格，以及未投遞／診斷區；可從卡片開啟**建立任務**對話框。
- **主要給誰**：投手、營運、老闆。
- **情境**：查哪個商品該加碼／縮手、誰負責、底部診斷與未映射廣告。

## 2. 進入方式

- **route**：`/products`。
- **從哪裡來**：側欄主導航「商品中心」、設定中心連結、首頁摺疊文案導流。
- **前置條件**：登入；依 workbench 帶 scope。**無前端路由權限擋**（**待確認** API）。
- **商品詳情（程式現況）**：無獨立 route（例如無 `/products/:productName`）；詳情為格狀 `ProductsBattleCard`＋`ProductCreateTaskDialog`。

## 3. 首屏必須看到的內容

1. **`ProductsHeader`**：側欄＋標題「商品中心」。
2. **`AccountExceptionsBlock`**（compact）：帳戶／商品例外提示。
3. **`FilterBar`**：商品／負責人／儲存視圖／狀態／最低花費／排序—**首屏核心控制**。
4. **`ProductsOwnersTable`**：負責人維度表—**與卡片並存，勿被設計吃掉**。
5. **`ProductsOverviewBoard`**：筆數、總花費、總營收、平均 ROAS。

## 5. 區塊排列順序（上→下）

- Header → `AccountExceptionsBlock` → `FilterBar` → `ProductsOwnersTable` → `ProductsOverviewBoard` → `ParetoCommandLayerStrip` → `VisibilityPolicyStrip` → `DormantGemsSurfaceSection` → **作戰卡 grid**（`ProductsBattleCard`）→ 篩選空狀態卡 → `ProductsNoDeliveryPanel` → `ProductCreateTaskDialog`（條件 open）。

**布局**：單欄為主；表格與卡片上下堆疊。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- **建立任務**（於 dialog 內與觸發點—具體 label **待確認** `ProductCreateTaskDialog`）：完成營運閉環。

### B. 次按鈕（Secondary）

- `FilterBar` 內切換、排序、儲存視圖—**待確認**元件內按鈕名。

### C. 危險按鈕（Danger）

- **待確認** dialog 是否含刪除或高風險動作。

### D. 輔助按鈕（Utility）

- **`SidebarTrigger`**；卡片內連結／操作**待確認**。

## 7. 篩選 / 控制元件

- **`FilterBar`**：`productOptions`、`ownerOptions`、`showSavedViews`、`showStatusFilter`、`showMinSpend`、`showSort`—**至少首屏保留一列**，其餘可收 **更多** 但不可全滅。
- 無全頁日期（與首頁／fb-ads 不同）**待確認** scope 是否由他頁繼承。

## 7. 狀態資訊 / badge / warning

- **篩選結果為空**：中央提示「無符合條件的商品…」。
- **`VisibilityPolicyStrip` / Dormant**：與首頁語意一致—**不可隱藏**。
- **`ProductsNoDeliveryPanel`**：未投遞、unmapped—**屬診斷，不可刪區塊**。

## 9. 可收合但不能消失的區塊

- **`ProductsNoDeliveryPanel`**：可預設摺疊但**必須保留入口**。
- **`ParetoCommandLayerStrip` / `VisibilityPolicyStrip` / `DormantGemsSurfaceSection`**：**不可刪**，可視覺弱化不可移除。

## 9. 此頁最不能被 AI 誤改的地方

- **`FilterBar`＋`ProductsOwnersTable`＋作戰卡**三層結構。
- **未投遞／診斷面板**與**建立任務** dialog 觸發路徑。

## 10. Stitch 用摘要

商品中心沒有獨立詳情 URL，詳情在格狀作戰卡與對話框。首屏要保留篩選列與負責人表，再來是總覽數字與 Pareto／政策列，最後才是卡片與底部未投遞診斷。主 CTA 是從商品情境建立任務。視覺優化應讓篩選與表在首屏可掃，不要把所有東西變成單一卡片牆而找不到責任歸屬與診斷。

（約 210 字）
