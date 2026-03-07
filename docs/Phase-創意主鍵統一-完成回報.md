# Phase：創意主鍵統一（Creative Identity）- 完成回報

## 1. 完成狀態

**完成。** 已定義生命週期／任務／投放的統一 key（campaignId、draftId），盤點各處 ID 使用、補齊任務 draftId 與投放深連結精準開啟草稿，並產出 creative-identity 文件與 shared resolver。

---

## 2. 現在統一 Key 是什麼

| 維度 | 統一 Key | 說明 |
|------|----------|------|
| **生命週期／Campaign** | **campaignId** | 與素材生命週期「一筆素材」對應；生命週期 API 的 `item.id`、WorkbenchMapping `campaign:*` 均為此值。任務的 `creativeId` 在 campaign 脈絡下應存 campaignId。 |
| **投放草稿** | **draftId** | 投放草稿唯一 ID（系統內）；任務直連草稿時存於 `WorkbenchTask.draftId`，深連結用 `/publish?draftId=`。 |

---

## 3. 已完成項目

### 一、定義與盤點

- **docs/creative-identity.md**：定義 canonical creative key（生命週期 = campaignId、投放 = draftId）、各模組 ID 盤點表、Resolver 邏輯（任務→生命週期、任務→投放）、fallback 說明、驗收案例。

### 二、Shared resolver

- **shared/creative-identity.ts**：`CANONICAL_CREATIVE_KEY_LIFECYCLE`、`TASK_CREATIVE_ID_SEMANTIC_FOR_LIFECYCLE`、`resolveTaskCreativeIdForLifecycle(creativeId)`、`lifecycleItemMatchesCreativeKey(itemId, itemName, creativeKey)`。生命週期前端可選改為引用此模組集中比對。

### 三、生命週期對齊 campaignId

- **API**：creative-lifecycle 每個 `item` 加上 `campaignId: row.campaignId`（與 `item.id` 一致）。
- **前端**：URL 支援 `?creativeId=` 與 `?campaignId=`（同一 canonical key）；篩選為「先 id 完全匹配，再名稱包含」；未命中提示改為「campaignId/ID 或名稱含…」。

### 四、任務 draftId 與投放深連結

- **Schema / 類型**：`WorkbenchTask` 新增 `draftId`（Prisma、workbench-types、workbench-db、POST /api/workbench/tasks 皆支援）。
- **任務中心「投放」按鈕**：若 `t.draftId` 有值，連結改為 `/publish?draftId=${encodeURIComponent(t.draftId)}`（優先於 productName / creativeId），title「開啟對應草稿」。
- **投放頁**：`getPublishUrlParams` 解析 `?draftId=`；當 URL 有 draftId 且 drafts 已載入時，以 `drafts.find(d => d.id === draftId)` 找到草稿後呼叫 `openEdit(draft)` 並 `setFormOpen(true)`，精準開啟該草稿（以 ref 避免重複開啟）。

---

## 4. 哪些地方已對齊

| 項目 | 對齊方式 |
|------|----------|
| 生命週期 API | `item.id`、`item.campaignId` 均為 campaignId，前端可明確使用。 |
| 生命週期前端 | URL 接受 creativeId / campaignId 同一語意；篩選優先 id 完全匹配。 |
| 任務 → 生命週期 | 任務 creativeId 存 campaignId 時，連結帶 creativeId/campaignId，生命週期以 item.id 精準匹配。 |
| 任務 → 投放 | 任務有 draftId 時，連結 `/publish?draftId=`，投放頁依 draft.id 開啟該草稿。 |
| 任務建立 | API 與 DB 支援寫入 draftId；生命週期建立任務時可寫入 item.id 至 creativeId。 |

---

## 5. 哪些仍 Fallback

| 情境 | 目前行為 |
|------|----------|
| 生命週期未命中 id | 以「名稱包含」篩選或顯示全部（相容舊資料或非 campaignId 的 creativeId）。 |
| 任務僅有 creativeId、無 draftId | 投放連結帶 `?creativeId=` 或 `?productName=`，投放頁不依 creativeId 篩選草稿（草稿無 creativeId 欄位）。 |
| 無 creativeId / draftId | 點「素材」→ 生命週期全部；點「投放」→ productName 預填或僅開投放首頁。 |

---

## 6. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| **docs/creative-identity.md** | 新增：統一 key 定義、盤點表、Resolver、fallback、驗收案例。 |
| **shared/creative-identity.ts** | 新增：常數、resolveTaskCreativeIdForLifecycle、lifecycleItemMatchesCreativeKey。 |
| **client/src/pages/creative-lifecycle.tsx** | URL 雙參數 creativeId/campaignId、變數 creativeKeyFromUrl、篩選與提示文案。 |
| **server/routes.ts** | creative-lifecycle API 的 item 加 campaignId；POST /api/workbench/tasks 接受 draftId。 |
| **prisma/schema.prisma** | WorkbenchTask 新增 draftId。 |
| **shared/workbench-types.ts** | WorkbenchTask 新增 draftId。 |
| **server/workbench-db.ts** | getWorkbenchTasks / createWorkbenchTask / rowToTask 支援 draftId。 |
| **client/src/pages/tasks.tsx** | 「投放」按鈕優先 `draftId` → `/publish?draftId=`，title「開啟對應草稿」。 |
| **client/src/pages/publish-placeholder.tsx** | getPublishUrlParams 增加 draftId；useRef + useEffect 依 draftId 開啟對應草稿。 |

---

## 7. 驗收案例（與 creative-identity.md 一致）

1. **任務 creativeId = campaignId**  
   任務 A 的 creativeId 為某 campaignId（與生命週期 item.id 一致）。點「素材」→ 進入生命週期，應篩選到該一筆、高亮且滾動到位（**id 完全匹配**，不依名稱）。

2. **任務 draftId 有值**  
   任務 B 的 draftId 為某草稿 ID。點「投放」→ 進入 `/publish?draftId=xxx`，投放頁應**開啟該草稿編輯**（精準）。

3. **無 creativeId / draftId**  
   點「素材」→ 生命週期全部；點「投放」→ 依 productName 預填或僅開投放首頁（fallback）。

4. **生命週期來源寫入任務**  
   自生命週期一鍵產生任務時（若有實作），寫入的 creativeId 應為該 item.id（campaignId），以便符合上述 1。

---

## 8. 驗收標準對照

| 驗收標準 | 狀態 |
|----------|------|
| 有 creative context 的任務，能更穩定地對到同一支素材 | ✅ 任務 creativeId 存 campaignId 時，生命週期以 item.id 精準匹配。 |
| 生命週期與任務不再主要依賴 name 包含匹配 | ✅ 優先 id 完全匹配；名稱包含僅為 fallback。 |
| 投放中心 deep link 能更精準 | ✅ 任務 draftId 時，投放頁依 draftId 開啟該草稿。 |
