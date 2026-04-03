# 統一 Creative Identity（創意主鍵）

## 1. 目標

讓任務、素材生命週期、Meta 素材、投放草稿之間，對「同一支素材」有穩定對應主鍵，減少依賴 `creativeId`/`campaignId`/名稱包含等半可靠匹配。

---

## 2. 統一 Key 定義

### 2.1 生命週期／Campaign 維度（目前主軸）

| 名稱 | 說明 | 使用處 |
|------|------|--------|
| **canonicalCreativeKey (campaign)** | 與素材生命週期「一筆素材」對應的穩定主鍵 | 生命週期 API 的 `item.id`、WorkbenchMapping `campaign:entityId` |
| **實作值** | 目前即 **Meta Campaign ID**（`campaignId`） | 生命週期由 campaign 維度彙總，故 item.id = row.campaignId |

**約定**：任務的 `creativeId` 欄位，當來源為「素材生命週期」或「Meta campaign 脈絡」時，應存入 **campaignId**，以便與生命週期 `item.id` 精準對應、與 WorkbenchMapping `campaign:*` 一致。

### 2.2 投放草稿維度

| 名稱 | 說明 | 使用處 |
|------|------|--------|
| **draftId** | 投放草稿唯一 ID（系統內） | WorkbenchTask.draftId、/publish?draftId= |

任務若來自投放流程或需直連某支草稿，可存 `draftId`；深連結時優先開啟該草稿。

### 2.3 其他 ID（保留／擴充用）

- **WorkbenchMapping** 已支援 `entityType`：`campaign` | `ad` | `adset` | `creative`（Meta 層級）。解析 product 時優先順序：creative > ad > adset > campaign。
- **Meta creative_id / ad_id**：未來若生命週期或任務改為「廣告/創意」維度，可再引入 `creative:*` 對應；目前生命週期仍為 campaign 維度，故主鍵以 campaignId 為準。

---

## 3. 盤點：各頁與 API 使用的 ID

| 模組 | 使用欄位 | 實際語意 | 對齊狀態 |
|------|----------|----------|----------|
| **任務 (WorkbenchTask)** | creativeId, productName, (draftId) | creativeId = campaignId 時與生命週期對齊；draftId 直連草稿 | 已約定 creativeId 存 campaignId；draftId 已支援 |
| **素材生命週期 API** | item.id, item.name | id = campaignId（CampaignRowForRoi.campaignId） | 已對齊：id 即 canonical key |
| **素材生命週期前端** | ?creativeId= 或 ?campaignId= | 篩選 item.id（= campaignId）或 name 包含 | 已對齊：優先 id 完全匹配，name 為 fallback |
| **任務 → 生命週期深連結** | task.creativeId → URL | 傳 campaignId；生命週期以 item.id 匹配 | 已對齊 |
| **任務 → 投放深連結** | task.draftId / productName / creativeId | draftId 時 /publish?draftId= 並開啟該草稿；否則 productName 預填 | draftId 已支援；creativeId 僅帶參數 |
| **投放草稿 (PublishDraft)** | id, assetPackageId, ... | 無 campaignId/creativeId；以 id 為準 | 任務.draftId 對應 draft.id |
| **WorkbenchMapping** | entityType:entityId → productName | campaign / ad / adset / creative | 解析時 creative > ad > adset > campaign |
| **Meta 資料** | campaign_id, ad_id, creative_id | 由 meta-data-fetcher 彙總為 campaign 維度 | 生命週期入口為 campaignId |

---

## 4. Resolver 與對齊邏輯

### 4.1 任務 → 生命週期

- **輸入**：task.creativeId  
- **規則**：視為 **campaignId**（canonical key）。  
- **行為**：連結 `/creative-lifecycle?creativeId={task.creativeId}` 或 `?campaignId={task.creativeId}`；生命週期以 `item.id === creativeId` 精準匹配，僅在無匹配時才 fallback 為名稱包含。

### 4.2 任務 → 投放

- **輸入**：task.draftId、task.productName、task.creativeId  
- **規則**：  
  - 若有 **draftId**：`/publish?draftId={draftId}`，投放頁開啟該草稿（精準）。  
  - 否則若有 **productName**：`/publish?productName=` 預填表單。  
  - 否則若有 **creativeId**：`/publish?creativeId=`（目前僅帶參數，未對應單一草稿）。  
- **Fallback**：無上述欄位時連結 `/publish`。

### 4.3 生命週期／來源寫入任務時

- 從「素材生命週期」或「Meta campaign」建立任務時，應將該筆的 **campaignId** 寫入 task.creativeId，以利後續深連結與 mapping 解析一致。

---

## 5. 仍為 Fallback 的部分

| 情境 | 目前行為 | 說明 |
|------|----------|------|
| 生命週期未命中 id | 以「名稱包含」篩選或顯示全部 | 相容舊資料或非 campaignId 的 creativeId |
| 任務僅有 creativeId、無 draftId | 投放連結帶 ?creativeId=，投放頁未依其篩選草稿 | 草稿無 creativeId 欄位，需日後擴充或 mapping |
| Meta creative_id 與 campaign_id | 未建 creative_id → campaign_id 對照表 | 生命週期目前僅 campaign 維度，必要時可擴 API |

---

## 6. 驗收案例

1. **任務 creativeId = campaignId**  
   - 任務 A 的 creativeId 為某 campaignId（與生命週期 item.id 一致）。  
   - 點「素材」→ 進入生命週期，應篩選到該一筆、高亮且滾動到位（**id 完全匹配**，不依名稱）。

2. **任務 draftId 有值**  
   - 任務 B 的 draftId 為某草稿 ID。  
   - 點「投放」→ 進入 `/publish?draftId=xxx`，投放頁應開啟該草稿編輯（精準）。

3. **無 creativeId / draftId**  
   - 點「素材」→ 生命週期全部；點「投放」→ 依 productName 預填或僅開投放首頁（fallback）。

4. **生命週期來源寫入任務**  
   - 自生命週期一鍵產生任務時（若有實作），寫入的 creativeId 應為該 item.id（campaignId），以便符合上述 1。
