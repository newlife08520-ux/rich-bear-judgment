# Phase 3A 任務中心工作台 — 完成回報

## 1. 完成狀態

**Phase 3A 已完成。** 任務中心已從「任務列表」升級為工作台：Schema 擴充、API 與任務中心 UI（來源／優先級／截止日／影響金額／類型、只看我負責、批次操作、建立表單新欄位、排序與提示）均已實作並可驗收。

---

## 2. 已完成項目

| 項目 | 說明 |
|------|------|
| **WorkbenchTask schema 擴充** | 新增 `taskSource`、`priority`、`dueDate`、`impactAmount`、`taskType`；保留既有 `productId`／`productName`、`creativeId`。 |
| **任務中心 UI 補強** | 列表顯示：任務來源、優先級、截止日、影響金額、任務類型、對應商品·素材；摘要區含「只看我負責」篩選與工作台提示。 |
| **只看我負責** | 勾選後以 `GET /api/workbench/tasks?onlyMine=1` 取得僅指派給當前登入使用者的任務。 |
| **批次操作** | 勾選多筆後可「批次改狀態」「批次指派」，呼叫 `PATCH /api/workbench/tasks/batch`。 |
| **建立任務表單** | 新增任務來源（預設「手動」）、優先級、截止日、影響金額、任務類型；POST 建立時一併送出。 |
| **工作台感** | 摘要區顯示待分配／進行中／已完成數量；列表依「進行中優先 → 優先級 → 截止日」排序；提示「依優先級與截止日安排，先處理高優先與即將到期任務」。 |

---

## 3. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `prisma/schema.prisma` | `WorkbenchTask` 新增 `taskSource`、`priority`、`dueDate`、`impactAmount`、`taskType`（皆可選）。 |
| `shared/workbench-types.ts` | `WorkbenchTask` 介面補上上述欄位；新增 `TASK_SOURCE_LABELS`、`TASK_PRIORITY_LABELS`。 |
| `server/workbench-db.ts` | `getWorkbenchTasks(options?.assigneeId)`、`createWorkbenchTask`／`updateWorkbenchTask` 支援新欄位；新增 `batchUpdateWorkbenchTasks(ids, patch, userId)`；`rowToTask` 含新欄位。 |
| `server/routes.ts` | GET `/api/workbench/tasks` 支援 `onlyMine`；PATCH `/api/workbench/tasks/batch`；POST/PATCH 任務 body 支援新欄位。 |
| `client/src/pages/tasks.tsx` | 只看我負責勾選、新欄位欄位、勾選列＋全選、批次改狀態／批次指派 Dialog、建立任務表單新欄位、列表排序與摘要提示。 |

---

## 4. 驗收步驟

1. **Schema 與列表**
   - 啟動 app，進入「任務中心」。
   - 確認列表表頭有：來源、優先級、標題／商品·素材、建議動作、理由、截止日、影響金額、類型、指派、狀態、備註、更新。
   - 若有既有任務，新欄位可為空或「—」；建立新任務時可帶入新欄位後再確認列表顯示。

2. **只看我負責**
   - 勾選「只看我負責」，確認請求為 `GET /api/workbench/tasks?onlyMine=1`，列表僅顯示 `assigneeId === 當前登入使用者` 的任務（若為 mock 登入，需確認 session 的 userId 與預期一致）。

3. **批次操作**
   - 勾選多筆任務，確認出現「已選 N 筆」與「批次改狀態」「批次指派」。
   - 點「批次改狀態」→ 選一狀態，確認該 N 筆狀態更新且列表刷新。
   - 再勾選多筆，點「批次指派」→ 選一員，確認該 N 筆指派更新且列表刷新。

4. **建立任務**
   - 點「建立任務」，填寫標題、建議動作、理由，並選擇任務來源、優先級、截止日，選填影響金額、任務類型、商品名稱。
   - 送出後確認列表出現新任務且新欄位顯示正確。

5. **工作台感**
   - 確認摘要區有「待分配／已指派」「進行中」「已完成／待確認」數量與「依優先級與截止日安排…」提示。
   - 確認列表順序為：進行中任務在前，其次依優先級（高→中→低）、再依截止日（近的在前）。

---

## 5. 未完成與原因

- **無。** 本階段必做範圍均已完成。  
- **建議後續**：從「審判官／素材生命週期／汰換建議」一鍵產生任務時，帶入對應 `taskSource`，方便篩選與報表。

---

## 6. 截圖

請於實際環境擷取以下畫面備查：

1. **任務中心工作台**：摘要區（含「只看我負責」）＋列表（含來源、優先級、截止日、影響金額、類型、商品·素材）。
2. **勾選多筆後**：顯示「已選 N 筆」與「批次改狀態」「批次指派」按鈕。
3. **建立任務 Dialog**：含任務來源、優先級、截止日、影響金額、任務類型欄位。

---

*Phase 3A 完成回報 — 任務中心升級為工作台，可進下一階段（不含投放中心 wizard）。*
