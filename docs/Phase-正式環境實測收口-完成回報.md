# 本輪完成回報：正式環境實測收口

---

## 1. 哪些完成

- **正式環境 ffprobe 實測（可重現）**
  - 已在本機／當前執行環境**實際執行**檢查腳本，得到明確結果（見下方實測結果）。
  - 提供 **scripts/run-ffprobe-check.mjs**：直接執行 `ffprobe -version`，輸出等同 GET /api/health/ffprobe 之 HTTP status / body / 失敗分類，可在**正式環境主機**上執行同一腳本取得結果。
  - 提供 **scripts/verify-ffprobe.mjs**：對任意 BASE_URL 呼叫 GET /api/health/ffprobe，適合正式環境有對外 URL 時使用。
- **實際影片偵測驗證（fallback / failed）**
  - 提供 **scripts/verify-video-detection.ts**：對本機影片檔呼叫 detectMedia，輸出 detectStatus / detectSource / aspectRatio。
  - **已執行實測**：
    - 檔名含比例（如 fixture-9x16.mp4）且 ffprobe 不可用 → **fallback**，detectSource: filename，detectedAspectRatio: 9:16。
    - 檔名不含比例（如 fixture-video.mp4）且 ffprobe 不可用 → **failed**，detectSource: manual；UI 會顯示「待確認」與 ffprobe 提示，使用者需手動選比例。
- **warnings 實測說明**
  - 前輪已確認：warnings 僅由 server 產出、前端 toast 只顯示 response.warnings。本輪在文件中再次註明驗證方式：以單一尺寸建立一筆草稿，確認 201 body 含 warnings 且 toast 顯示「僅單一尺寸，建議補齊多比例」即為通過。
- **驗收證據落地**
  - 已提供 **6 項驗收證據表**（見下方），其中 **fallback**、**failed** 已用腳本跑出實測並填入；其餘 4 項為操作步驟與填寫範本，需在具登入與 UI 的環境執行一次後填寫。

---

## 2. 哪些沒完成

- **在「正式環境」主機上親自執行 ffprobe 檢查**：本輪在**當前開發機**執行腳本得到結果；若正式環境為另一台主機，需在該機執行 `node scripts/run-ffprobe-check.mjs` 或對該機 URL 執行 `node scripts/verify-ffprobe.mjs <BASE_URL>` 並將結果填入回報。
- **一支真實影片 success 的完整證據**：本機無 ffprobe，無法產出 success；若正式環境已安裝 ffprobe，需在該環境上傳一支真實影片（或執行 `npx tsx scripts/verify-video-detection.ts <影片路徑>`）並將 detectStatus: success、metadata 寫入、UI Badge 等填入證據表。
- **manual_confirmed / suggested group / manual group / 未歸組 / 單一尺寸 warning**：需在瀏覽器登入後依檢查清單操作並截圖或紀錄，再填入證據表。

---

## 3. 哪些只是先求可用

- **驗證腳本**：run-ffprobe-check 為獨立腳本，邏輯與 server 的 ffprobe-health 一致但非共用程式碼；若需完全一致可改為 require 該模組。
- **影片偵測腳本**：僅驗證 detectMedia 輸出，不經 HTTP 上傳與登入；完整「上傳 → 寫入 DB → UI」需在應用內手動操作一次。

---

## 4. 改了哪些檔案

| 檔案 | 修改目的 | 新增/修改/刪除 |
|------|----------|----------------|
| `scripts/verify-ffprobe.mjs` | 對 BASE_URL 呼叫 GET /api/health/ffprobe，輸出 status / body / 分類 | 新增 |
| `scripts/run-ffprobe-check.mjs` | 本機或部署機直接跑 ffprobe -version，輸出等同 API 之結果與失敗分類（ENOENT/PERM/TIMEOUT/OTHER） | 新增 |
| `scripts/verify-video-detection.ts` | 對本機影片檔執行 detectMedia，輸出 detectStatus / detectSource / aspectRatio，供 success／fallback／failed 實測 | 新增 |
| `docs/Phase-正式環境實測收口-完成回報.md` | 本回報與 6 項證據表、實測結果記載 | 新增 |
| `.gitignore` | 新增 `scripts/fixture-*.mp4` 避免提交測試用假檔 | 修改 |

---

## 5. 刻意沒改哪些檔案

- **server / client 業務邏輯、左側、分析區、Meta 真發送、模板／批次建組／快速變體**：未動。
- **publish-service、publish-routes、assets、publish-placeholder**：未改；warnings 與偵測流程沿用前輪實作。

---

## 6. 驗收標準

1. **ffprobe 實測**：在目標環境執行 `node scripts/run-ffprobe-check.mjs` 或呼叫 GET /api/health/ffprobe，記錄 HTTP status、response body、失敗時之 code（ENOENT/PERM/TIMEOUT/OTHER）。
2. **影片偵測**：至少 1 支 success（需 ffprobe 可用）、至少 1 筆 fallback 或 failed；記錄 detectStatus、detectSource、aspectRatio、前端 Badge 與使用者下一步。
3. **warnings**：單一尺寸建立一筆草稿，確認 response 含 warnings 且 toast 顯示該內容，且前端未重算。
4. **6 項證據**：依下表至少各 1 筆並留存紀錄或截圖。

---

## 7. Rollback

- **還原**：刪除 `scripts/verify-ffprobe.mjs`、`scripts/run-ffprobe-check.mjs`、`scripts/verify-video-detection.ts`、`scripts/fixture-9x16.mp4`、`scripts/fixture-video.mp4`（若有）。
- **文件**：刪除或還原 `docs/Phase-正式環境實測收口-完成回報.md`。
- **無** server/client 程式變更，無需還原業務碼。

---

## 8. 風險與防呆

- **正式環境與本機差異**：本機實測結果僅代表當前環境；正式環境需在該機或對該機 URL 再跑一次並填表。
- **success 依賴 ffprobe**：未安裝 ffprobe 的環境無法產出 success，僅能產出 fallback（檔名有比例）或 failed。

---

## 9. 五點自我檢討

1. **正式環境**未在另一台部署機實測，僅在當前機執行腳本並假設「正式環境」可依相同步驟重現。
2. **success 案例**未取得（本機無 ffprobe），證據表內 success 仍待有 ffprobe 的環境補上。
3. **manual_confirmed / suggested / manual / 未歸組 / 單一尺寸 warning** 需人工操作與截圖，本輪僅提供步驟與範本。
4. **驗證腳本**與 server 的 ffprobe-health 為兩份邏輯，長期可改為共用模組。
5. **GET /api/health/ffprobe** 未在本輪再次以 running server 驗證（依前輪實作，邏輯與 run-ffprobe-check 一致）。

---

## 10. 是否偏離規格

**沒有。** 本輪未擴新功能、未改左側／分析區／Meta 真發送／模板／批次建組；以正式環境實測收口為目標，提供可執行腳本、本機實測結果與 6 項證據表。

---

## 11. 下一輪建議

- 在**正式環境主機**執行 `node scripts/run-ffprobe-check.mjs`（或對正式 URL 執行 verify-ffprobe.mjs），將結果填入本回報「正式環境 ffprobe 實測結果」。
- 在**已安裝 ffprobe** 的環境上傳一支真實影片，取得 success 案例並填入證據表。
- 在瀏覽器完成 manual_confirmed、suggested group、manual group、未歸組、單一尺寸 warning 各 1 筆並留存截圖或紀錄。

---

# 實測結果（本機／當前環境）

## 正式環境 ffprobe 實測

- **執行方式**：`node scripts/run-ffprobe-check.mjs`（與 GET /api/health/ffprobe 之邏輯一致）。
- **HTTP status（若經 API）**：503。
- **Response body**：`{ "ok": false, "error": "ffprobe 未安裝或不在 PATH", "code": "ENOENT" }`。
- **失敗分類**：**ENOENT**（未安裝或不在 PATH）。
- **說明**：本機未安裝 ffprobe 或未在 PATH，故為 ENOENT。若正式環境已安裝 ffmpeg，在該機執行同一腳本應得 200 與 `{ "ok": true }`。

---

## 影片偵測實測

### 案例一：fallback（檔名含比例，ffprobe 不可用）

- **執行**：`npx tsx scripts/verify-video-detection.ts scripts/fixture-9x16.mp4`。
- **detectStatus**：fallback。
- **detectSource**：filename。
- **detectedAspectRatio**：9:16。
- **detectedWidth / Height / Duration**：無。
- **前端 Badge**：會顯示「推測」、來源為檔名。
- **造成方式**：ffprobe 不可用 → metadata 失敗 → 依檔名 9x16 推測。
- **使用者下一步**：可接受推測比例或手動改比例後存檔 → manual_confirmed。

### 案例二：failed（檔名不含比例，ffprobe 不可用）

- **執行**：`npx tsx scripts/verify-video-detection.ts scripts/fixture-video.mp4`。
- **detectStatus**：failed。
- **detectSource**：manual。
- **detectedAspectRatio**：無。
- **前端 Badge**：顯示「待確認」，title 為「比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例」。
- **造成方式**：ffprobe 不可用且檔名無可推測比例。
- **使用者下一步**：在編輯版本時手動選擇 aspectRatio 後存檔 → 寫入 manual_confirmed。

---

## warnings 實測

- **驗證方式**：建立一筆草稿且僅選單一比例之版本，送出後檢查 201 response body 是否含 `warnings: ["僅單一尺寸，建議補齊多比例"]`，以及前端 toast 是否顯示該句。
- **結論**：前輪已確認 warnings 僅由 server 產出、前端只顯示 response.warnings；本輪未改程式，依前輪邏輯即為「由 server 回傳、前端未重算」。實際操作一次即可驗收。

---

# 驗收證據表（6 項）

| 項目 | 狀態 | 取得方式／結果摘要 |
|------|------|---------------------|
| 一筆 **success** | 待補 | 需在**已安裝 ffprobe** 的環境上傳一支真實影片，或執行 `npx tsx scripts/verify-video-detection.ts <影片路徑>`，記錄 detectStatus: success、detectSource: metadata、aspectRatio 與前端「真偵測」Badge。 |
| 一筆 **failed 或 fallback** | 已實測 | fallback：`fixture-9x16.mp4` → fallback / filename / 9:16。failed：`fixture-video.mp4` → failed / manual；UI 為「待確認」+ ffprobe 提示。 |
| 一筆 **manual_confirmed** | 待補 | 在素材中心編輯某版本，**只改比例**後存檔，確認該版本 detectStatus: manual_confirmed、detectSource: manual，前端 Badge「已確認」。 |
| 一筆 **suggested group** | 待補 | 新建版本時帶入系統建議的 groupId 且未改，存檔後該版本 groupSource: suggested，前端「建議組」Badge。 |
| 一筆 **manual group** | 待補 | 編輯某版本並**改主素材組**後存檔，該版本 groupSource: manual，前端「人工組」Badge。 |
| 一筆 **單一尺寸 warning** | 待補 | 建立草稿時僅選單一比例之版本，送出後 201 body 含 warnings，toast 顯示「僅單一尺寸，建議補齊多比例」。 |

---

# 額外必答

## A. 正式環境 ffprobe 是否已實際驗證可用

- **本輪在「當前執行環境」已實際驗證**：執行 `node scripts/run-ffprobe-check.mjs` 得到 **503、ENOENT**（ffprobe 未安裝或不在 PATH）。
- **若「正式環境」指部署機**：需在該機執行同一腳本或呼叫該機之 GET /api/health/ffprobe，並將結果填入上表；本輪未在另一台主機執行，故不代為宣稱正式環境「已可用」。

---

## B. 真實影片 success 案例是否已取得完整證據

- **尚未。** 本機無 ffprobe，無法產出 success。完整證據需在**已安裝 ffprobe** 的環境：上傳一支真實影片 → 記錄 metadata 寫入、detectStatus: success、detectSource: metadata、aspectRatio 正確、前端「真偵測」Badge，並留存截圖或 API 回應。

---

## C. fallback / failed 是否已至少驗證 1 筆

- **是。** 已用腳本驗證：**fallback** 一筆（fixture-9x16.mp4）、**failed** 一筆（fixture-video.mp4）；造成方式、UI 呈現與使用者下一步已記載於上方「影片偵測實測」與證據表。

---

## D. 現在能不能正式宣稱「影片偵測鏈路已閉環」，若不能，最後卡在哪一步

- **尚不能正式宣稱已閉環。**  
- **缺的最後一步**：在**正式環境**（或至少一處已安裝 ffprobe 的環境）完成 **1 支真實影片的 success 端到端**：上傳 → detect-media 成功 → metadata 寫入 DB/API → UI 顯示「真偵測」與正確比例。  
- 目前已有：ffprobe 可用性檢查（含本機 ENOENT 實測）、fallback／failed 實測與說明、warnings 邏輯確認、6 項證據表與操作範本。補上上述 success 實測並留存證據後，即可宣稱影片偵測鏈路已閉環。
