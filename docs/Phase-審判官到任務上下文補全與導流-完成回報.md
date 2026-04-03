# Phase：審判官到任務的上下文補全與導流完成 - 完成回報

## 1. 完成狀態

**完成。** 一鍵轉任務已升級為帶完整上下文的執行入口；建立後高亮到該筆任務；任務列支援深連結至商品／素材／審判／投放。

---

## 2. 已完成項目

### 一、productName / creativeId / impactAmount / reviewSessionId 補全

- **審判官頁面**：從 URL 讀取 `productName`、`creativeId`、`impactAmount`（例：`/judgment?sessionId=rs-xxx&productName=YYY&creativeId=zzz&impactAmount=5萬`），並與當前 `session.id` 一併組成 `judgmentContext` 傳入裁決工作台。
- **一鍵轉任務**：建立任務時送出 `productName`、`creativeId`、`impactAmount`、`reviewSessionId`（當前對話串 ID）。有 URL 參數或 session 時即帶入，無法判斷時為 `null`。
- **後端**：`WorkbenchTask` 新增欄位 `reviewSessionId`（Prisma + shared 型別 + workbench-db + POST /api/workbench/tasks），建立任務時寫入並回傳。

### 二、建立後高亮到該筆任務

- 一鍵轉任務成功後導向 **`/tasks?highlight=<taskId>`**。
- **任務中心**：解析 `?highlight=`，對該筆任務的表格列加上視覺高亮（`bg-primary/10 ring-2 ring-primary`），並 `scrollIntoView({ behavior: "smooth", block: "nearest" })` 滾動到該列。

### 三、任務深連結

- **商品作戰室**：有 `productName` 時連結為 `/products?productName=<encode>`，商品頁會讀取該參數並以 `setProductFilter([productName])` 篩選到對應商品；無則 `/products`。
- **素材生命週期**：有 `creativeId` 時連結為 `/creative-lifecycle?creativeId=<encode>`（目前頁面尚未依參數篩選，保留參數供日後擴充）；無則 `/creative-lifecycle`。
- **RICH BEAR 審判官**：有 `reviewSessionId` 時連結為 `/judgment?sessionId=<encode>` 直接開啟該判讀對話；無則 `/judgment`。
- **投放中心**：連結為 `/publish`（任務目前無 campaignId，維持通用入口）。

---

## 3. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| **prisma/schema.prisma** | `WorkbenchTask` 新增 `reviewSessionId String?`。 |
| **shared/workbench-types.ts** | `WorkbenchTask` 新增 `reviewSessionId?: string \| null`。 |
| **server/workbench-db.ts** | `getWorkbenchTasks` / `createWorkbenchTask` / `rowToTask` 支援 `reviewSessionId`。 |
| **server/routes.ts** | `POST /api/workbench/tasks` body 接受並寫入 `reviewSessionId`。 |
| **client/src/pages/judgment.tsx** | 新增 `parseJudgmentUrlParams`、`JudgmentContext`；讀取 URL 的 productName/creativeId/impactAmount；傳入 `judgmentContext`（含 sessionId）給 `JudgmentWorkbenchBubble`；一鍵轉任務 payload 帶入 context 並送 `reviewSessionId`；成功後 `setLocation(\`/tasks?highlight=${data.id}\`)`。 |
| **client/src/pages/tasks.tsx** | 新增 `getHighlightTaskId`、`rowRefs`、`useEffect` 滾動至高亮列；`<tr>` 加 `ref`、`data-task-id`、高亮樣式；操作列四顆按鈕改為深連結（商品／素材／審判／投放）。 |
| **client/src/pages/products.tsx** | 新增 `getProductNameFromUrl`、`useEffect`：若有 `?productName=` 且存在於 productLevel 則 `setProductFilter([productName])`。 |

---

## 4. 上下文補全邏輯說明

| 欄位 | 來源 | Fallback |
|------|------|----------|
| **productName** | 審判官 URL 參數 `?productName=xxx`（例如從商品作戰室或任務中心帶入連結時）。 | 無則 `null`，任務建立後仍可手動補。 |
| **creativeId** | 審判官 URL 參數 `?creativeId=xxx`（例如從素材中心帶入連結時）。 | 無則 `null`。 |
| **impactAmount** | 審判官 URL 參數 `?impactAmount=xxx`（例：`5萬`、`約 10 萬`）。 | 無則 `null`；未來可考慮由結構化輸出的 evidence 推導。 |
| **reviewSessionId** | 當前審判官對話串 `session.id`（一鍵轉任務時一定在該頁，故可帶入）。 | 非從審判官建立則無此欄位，任務列「審判」按鈕仍會連到 `/judgment`。 |

**使用方式**：從商品作戰室或素材中心要「針對此商品／素材開審判」時，可導向  
`/judgment?productName=商品名&creativeId=素材ID`（或僅其一），審判完成後一鍵轉任務即會帶入對應 context；若從審判官直接開新對話未帶參數，則 productName/creativeId/impactAmount 為 null，僅 reviewSessionId 會帶入。

---

## 5. 驗收步驟

1. **上下文補全**  
   - 開啟 `/judgment?productName=某商品&impactAmount=約5萬`，完成一則判讀後點「一鍵轉任務」。  
   - 到任務中心查看該任務：應有商品名稱、影響金額、任務來源「審判官」；若該任務有 `reviewSessionId`，可點「審判」按鈕應會開啟對應判讀對話。

2. **建立後高亮**  
   - 在審判官一鍵轉任務成功後，應自動跳轉至 `/tasks?highlight=<id>`，任務中心該筆任務列有高亮樣式且畫面滾動到該列。

3. **任務深連結**  
   - 有 productName 的任務：點「商品」按鈕應進入商品作戰室且篩選到該商品。  
   - 有 reviewSessionId 的任務：點「審判」按鈕應進入該判讀對話。  
   - 有 creativeId 的任務：點「素材」按鈕應進入素材生命週期頁（目前頁面未依 creativeId 篩選，連結與參數已保留）。  
   - 點「投放」按鈕應進入投放中心 `/publish`。

---

## 6. 未完成與原因

- **素材生命週期依 creativeId 篩選**：任務列已帶 `?creativeId=` 連結，但 `creative-lifecycle` 頁面尚未實作讀取該參數並篩選／捲動到對應素材，僅保留 URL 與參數供後續擴充。
- **投放中心對應草稿**：任務模型未儲存 campaignId／草稿 ID，目前「投放」按鈕僅連到通用投放中心；若日後有草稿維度可再補欄位與深連結。
- **impactAmount 從 AI 推導**：目前僅能由 URL 帶入；若未來結構化輸出或 evidence 中有可解析之金額，可再於後端或前端補推導邏輯。

---

## 7. 截圖

（請於實際環境執行上述驗收步驟後，依需要補上：  
- 審判官帶 productName/impactAmount 建立任務後，任務中心該筆任務之欄位與高亮  
- 任務列深連結按鈕（商品／素材／審判／投放）  
- 從任務點「審判」進入對應判讀對話之畫面）
