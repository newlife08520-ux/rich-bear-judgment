# Spec-Check：素材上傳穩定化修正

**狀態**：審視規格與現有程式碼後產出，**未完成本 spec-check 不准開始改**。  
本輪目標：比例偵測可信、縮圖真的看得到、主素材組自動建議；不擴功能、不補新花樣。

---

## 一、規格摘要（本輪要達成的）

### 1. 比例偵測要真的可信

- 若 **server 已成功偵測**：前端表單直接帶入正確比例，**不要再顯示「請手動選擇」**。
- 若 server 沒偵測到、但 **檔名含比例**（如 9x16、4:5、1x1）：才允許 fallback 用檔名解析，**UI 必須明確標示「推測」**。
- 若兩者都沒有：才進 failed / 待確認 / 手動選。

### 2. 縮圖要真的看得到

- **圖片**：上傳後版本卡一定能看到縮圖。
- **影片**：優先使用 **thumbnailUrl**；若 server 還沒產生 thumbnail，才暫時 fallback 用 `<video>`，**但 fallback 不能算正式完成**。投放中心與素材中心都要一致顯示。

### 3. 主素材組要自動建議

- 系統自動從檔名 / 產品名 / variant 規則推測（例：A版_9x16、潔測泡泡_A版_9x16 → 建議 A版 或 A）。
- 使用者可改，但不是必須先懂才能用。
- **UI 文案**：至少一種「主素材組（A/B/C，同一支素材不同尺寸可歸同組）」或「同支素材分組（選填）」+ 欄位下短說明。

### 4. 檔名解析規則（統一 parser）

- **比例**：支援 9x16、9:16、4x5、4:5、1x1、1:1、16x9、16:9（含底線 4_5 等）。
- **主素材組 / variant**：支援 A、A版、B、B版、C、C版 等。
- **優先順序**：server metadata（最優先）→ filename ratio / filename variant → 手動確認。

---

## 二、現況對照（審視結果）

### A. 比例偵測鏈路

| 環節 | 現況 | 是否符合規格 |
|------|------|--------------|
| upload route 回傳 detection | `asset-package-routes.ts` 已 `res.json({ ...result, detection })` | ✅ |
| client 上傳成功後寫進 pending | `assets.tsx` 取 `detection`，設 `suggestedRatio`、`nextDetection`、`setPendingDetection`、`setVersionForm(..., aspectRatio: suggestedRatio)` | ✅ 邏輯有 |
| 表單掉回 1:1 的可能原因 | ① server 未回傳 detection（如舊 process）② detection 有但 `detectedAspectRatio` 為空 ③ **檔名僅含 `4_5` 時 client 正則為 `(\d+)\s*[x×:]\s*(\d+)`，不支援底線**，fallback 失敗 → 變成 failed → 1:1 | ❌ 檔名 4_5 未支援 |
| server 檔名推測比例 | `detect-media.ts` 的 `guessRatioFromFilename` 僅 `(\d+)\s*[x×]\s*(\d+)`，**不支援 `:`**（如 4:5） | ❌ |
| create version body 帶 detect 與 aspectRatio | body 有 aspectRatio；pendingDetection 時寫入 detected*、detectStatus、detectSource | ✅ |
| version service / repo 寫入 | schema 與 service 皆有 detect*、thumbnailUrl | ✅ |
| GET versions 回傳 | 列表含 aspectRatio、detectStatus、detectSource | ✅ |
| 素材中心 / 投放中心顯示比例與 detect | 有 Badge 與比例顯示 | ✅ |
| UI「請手動選擇」顯示條件 | `pendingDetection?.detectStatus === "failed"` 或 `versionForm.assetType === "video" && !pendingDetection?.detectedAspectRatio && pendingDetection?.detectStatus !== "fallback"` 時顯示 | ⚠️ 若 server 回傳 success 但前端漏帶入，或檔名解析失敗，仍會出現 |

**結論**：鏈路大致完整；**檔名比例解析** server 僅支援 x/×、client 不支援底線（如 4_5），且 server 不支援 `:`，需補齊。**表單掉回 1:1** 需確保：server 有回傳且前端只在此二處顯示「請手動選擇」——success 時絕不顯示。

### B. 縮圖策略

| 項目 | 現況 | 是否符合規格 |
|------|------|--------------|
| 圖片縮圖 | 使用 `v.fileUrl` 的 img；無 thumbnailUrl 時仍用 fileUrl | ⚠️ 規格要求「上傳後版本卡一定能看到」；若 fileUrl 需登入且同源，理論上可；**規格另要求 image 時 thumbnailUrl = fileUrl**，目前未寫入 |
| 影片縮圖 | 有 thumbnailUrl 用 img；無則 fallback `<video>` 第一幀 | ⚠️ 規格：**優先 thumbnailUrl**；**若 server 還沒產生 thumbnail 才 fallback**，且 **fallback 不能算正式完成** → 需 **server 產出 thumbnail** |
| Server 產影片 thumbnail | **目前無**；無 ffmpeg 抽幀、無寫入 thumbnailUrl | ❌ |
| 圖片 thumbnailUrl 寫入 | 建立版本時未強制 image 填 thumbnailUrl = fileUrl | ❌ 需補 |

**結論**：  
- **圖片**：需在建立版本時（前端或後端）將 **thumbnailUrl = fileUrl** 寫入，並確保兩處列表都優先 thumbnailUrl（或無則 fileUrl）。  
- **影片**：需 **server 端** 在上傳或建立版本時用 ffmpeg/ffprobe 產出一張 thumbnail（jpg/png），寫入 **thumbnailUrl**；前端維持「優先 thumbnailUrl，無則 fallback &lt;video&gt;」，且 fallback 在文件/驗收中標示為非正式完成。

### C. 檔名解析（比例 + 主素材組）

| 項目 | 現況 | 是否符合規格 |
|------|------|--------------|
| 比例：client | `parseAspectRatioFromFilename` 使用 `(\d+)\s*[x×:]\s*(\d+)` → 支援 x、×、:**不支援底線 `_`**（如 4_5） | ❌ |
| 比例：server | `guessRatioFromFilename` 使用 `(\d+)\s*[x×]\s*(\d+)` → **不支援 `:`** | ❌ |
| 主素材組：client | `parseSuggestedGroupNameFromFilename`：依 `[_\-.]+` 分段，先找「版」「類」結尾，否則第一段 | ✅ 可解析 A版、A；規格要「潔測泡泡_A版_9x16 → A版 或 A」已可 | ⚠️ 可再明確支援「A」「B」「C」單字與「A版」「B版」 |
| 統一 parser | 比例與主素材組解析分散在 client 與 server，**無單一共用 parser**；規格要求「新增一個乾淨的 parser」 | ❌ 需新增（例如 `parse-asset-name.ts` 或共用 util） |

**結論**：  
- 需 **統一檔名解析**：比例支援 **9x16、9:16、4x5、4:5、4_5、1x1、1:1、16x9、16:9**（含底線、冒號）；主素材組支援 **A、A版、B、B版、C、C版**。  
- 優先順序：**server metadata → filename ratio / filename variant → 手動確認**；目前程式邏輯已大致依此，需在 parser 與 UI 文案上一致體現。

### D. UI 文案（主素材組）

| 項目 | 現況 | 是否符合規格 |
|------|------|--------------|
| 主素材組標籤 | 「主素材組（選填）」 | ❌ 規格要「主素材組（A/B/C，同一支素材不同尺寸可歸同組）」或「同支素材分組（選填）」 |
| 欄位下說明 | 有「建議主素材組：XXX（請先建立主素材組或選其他）」；**無**「例：A版的 9:16 / 4:5 / 1:1 可放同一組…」 | ❌ 需加一句短說明 |

---

## 三、驗收標準對照（本輪必須達成）

| 驗收 | 規格要求 | 現況缺口 |
|------|----------|----------|
| 驗收 1 | 上傳檔名含 4_5 或 4:5 的影片 → 類型影片、比例 4:5、不顯示「請手動選擇」；若非 metadata 則 Badge「推測」 | 檔名 4_5/4:5 解析需支援；success 時絕不顯示「請手動選擇」 |
| 驗收 2 | ffprobe 可偵測的 mp4 → success/metadata、比例正確、素材中心與投放中心皆見縮圖、「真偵測」 | 影片需有 thumbnailUrl（server 產出）；圖片需 thumbnailUrl=fileUrl |
| 驗收 3 | 檔名 A版_9x16_xxx.mp4 → 自動建議主素材組 A版 或 A、比例 9:16；無 group 時仍顯示「建議主素材組：A版」 | parser 與 UI 已部分支援；需確認 A版 優先並有說明文案 |
| 驗收 4 | 僅選一個 9:16 版本建立草稿 → 可建立；投放前檢查提示「僅單一尺寸，建議補齊多比例」 | 需確認是否有此檢查與提示（未在本次審視範圍，若無則需補） |
| 驗收 5 | 圖片與影片縮圖在素材中心、投放中心皆可見，並附實際 UI 截圖 | 依 B 補齊後再驗收 |

---

## 四、本輪預期會動到的檔案（對照規格）

- **後端**  
  - `server/modules/asset/detect-media.ts`：檔名比例支援 `:`、底線（或改用統一 parser）。  
  - `server/modules/asset/asset-package-routes.ts` 或 upload 流程：上傳影片後產 thumbnail、回傳或寫入 thumbnailUrl；圖片可在此或 create version 時設 thumbnailUrl = fileUrl。  
  - 新增或修改：**ffmpeg thumbnail 產出**（util/service），寫入 thumbnailUrl。  
  - `server/modules/asset/asset-version-service.ts`：若在 create 時寫入 thumbnailUrl（含圖片 = fileUrl），需帶入。  
  - `server/modules/asset/asset-version.schema.ts`：已有 thumbnailUrl，可不改。  
  - 新增（可選）：**`server/modules/asset/parse-asset-name.ts`**（或共用 util）統一比例 + 主素材組解析。  
- **前端**  
  - `client/src/pages/assets.tsx`：  
    - 比例：success 時不顯示「請手動選擇」；fallback 時明確「推測」；使用統一 parser（若在 client 也有）。  
    - 主素材組：Label 與欄位下說明改為規格文案。  
    - 建立版本時：圖片送 thumbnailUrl = fileUrl（若後端未自動帶）。  
  - `client/src/pages/publish-placeholder.tsx`：縮圖邏輯與素材中心一致（優先 thumbnailUrl，再 fallback）；若有「僅單一尺寸」提示則一併確認。  

**刻意不改**：左側主架構、分析區、Meta 真發送、新模板、新批次建組規則、Threads、全新頁面重構、大規模 schema 重寫。

---

## 五、優先順序與風險（spec 要求）

- **metadata 偵測、檔名推測、手動確認**：順序為 **metadata（最優先）→ 檔名推測 → 手動確認**；目前 client 邏輯已依此，server detect-media 亦同，需確保 parser 與 UI 一致。  
- **影片 thumbnail 產出失敗**：需有穩定 fallback（現有 &lt;video&gt;），**UI 不能白塊**。  
- **驗收 4（僅單一尺寸提示）**：需在程式內確認是否已有「投放前檢查」與對應提示，若無則本輪補上。

---

## 六、Spec-Check 結論

- **規格已審視**，並與現有程式碼對照完成。  
- **缺口已列出**：比例檔名解析（含 4_5、4:5）、server 影片 thumbnail、圖片 thumbnailUrl=fileUrl、統一 parser、主素材組 UI 文案與說明、必要時驗收 4 的提示。  
- **未完成本 spec-check 不准開始改**：本文件即為 spec-check 產物；**通過條件**為依本文件與規格進行修正，並滿足驗收 1～5 與完成回報格式。  

**下一步**：依本 spec-check 與「本輪只做」範圍，開始實作修正（先 parser／比例與主素材組，再 thumbnail 策略，再 UI 文案與驗收 4）。
