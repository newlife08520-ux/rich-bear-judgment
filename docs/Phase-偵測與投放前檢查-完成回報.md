# 本輪完成回報：素材偵測可信度 + 分組穩定度 + 投放前檢查

---

## 1. 哪些已完成

- **素材上傳後自動偵測並寫入**
  - 圖片：上傳後後端用 `image-size` 讀 width/height，算出 `aspectRatio`，寫入 `detectedWidth`、`detectedHeight`、`detectedAspectRatio`、`detectStatus`、`detectSource`。
  - 影片：後端用 `ffprobe`（child_process）讀 metadata（width/height/duration），算出 `aspectRatio`，寫入 `detectedWidth`、`detectedHeight`、`detectedAspectRatio`、`detectedDurationSeconds`、`detectStatus`、`detectSource`。
  - 偵測結果正式存入資料欄位（schema + version 建立/更新時寫入）；`detectStatus` 區分 success / fallback / failed；`detectSource` 區分 metadata / filename / manual。
- **主素材組改為「系統先建議、使用者再確認」**
  - 上傳後依檔名第一段（或「名稱+版」）建議主素材組名稱並預填 `groupId`；UI 保留人工修正；未分組版本明確標示「未歸組」，投放中心 fallback 組標示「未歸組／fallback 分組，不建議直接批次建組」。
- **投放中心新增「投放前檢查」區塊**
  - 建立草稿前顯示：已選廣告帳號、CTA 有效（未填預設來去逛逛）、已選素材版本、每個版本皆有類型與比例、是否存在 fallback 分組、是否僅單一尺寸（警告不擋）、粉專/IG 說明、落地頁網址；必要項未過時禁用「建立」按鈕。
- **CTA 規則收斂**
  - 投放中心 CTA 一律下拉；預設「來去逛逛」；載入素材包時若 CTA 為空或不在合法選項內，表單設為「來去逛逛」；送出時若 CTA 不在合法選項內，自動 fallback「來去逛逛」。
- **廣告帳號 / 粉專 / IG 現況標示**
  - 粉專、IG 下拉旁加說明：「目前粉專／IG 清單為該 Token 下所有可用項目，尚未依所選廣告帳號精準過濾。」（粉專/IG 已從 Meta API 取得、UI 為可搜尋下拉，僅未依廣告帳號過濾。）

---

## 2. 哪些沒完成

- **Threads 真正支援**：本輪不做，僅保留之後擴充 publisher platform 的結構。
- **依廣告帳號精準過濾粉專/IG**：未實作，僅在 UI 明確標示現況。

---

## 3. 哪些只是先求可用，不是最終版

- **影片偵測**：依賴主機是否安裝 `ffprobe`（ffmpeg）；未安裝或執行失敗時 `detectStatus=failed`，比例需手動選或依檔名 fallback。之後可考慮改為可選的雲端/worker 偵測。
- **Preflight 阻擋邏輯**：目前僅以「已選廣告帳號 + 已選版本 + 每版本有比例」作為可送出條件；落地頁、粉專/IG 未填僅顯示警告/說明，不擋建立。
- **主素材組建議**：目前僅依檔名第一段推斷同組，未用 AI 或更複雜規則；進階分組規則可下一輪再補。

---

## 4. 本輪改了哪些檔案

| 檔案 | 修改目的 | 新增/修改/刪除 |
|------|----------|----------------|
| `shared/schema.ts` | AssetVersion 新增 detectedWidth、detectedHeight、detectedAspectRatio、detectedDurationSeconds、detectStatus、detectSource | 修改 |
| `server/modules/asset/detect-media.ts` | 新增：圖片用 image-size、影片用 ffprobe 讀 metadata，回傳 DetectionResult（status/source） | 新增 |
| `server/modules/asset/asset-package-routes.ts` | 上傳後呼叫 detectMedia，回應帶 detection；建立版本時可帶入偵測欄位 | 修改 |
| `server/modules/asset/asset-version.schema.ts` | 版本 schema 支援偵測欄位 | 修改 |
| `server/modules/asset/asset-version-service.ts` | 建立/更新版本時寫入偵測欄位、durationSeconds 可從 detectedDurationSeconds 帶入 | 修改 |
| `client/src/pages/assets.tsx` | 上傳後存 pendingDetection、建立版本時送出並寫入後端；依檔名建議主素材組；版本卡片顯示未歸組/偵測狀態/比例 | 修改 |
| `client/src/pages/publish-placeholder.tsx` | 投放前檢查區塊、CTA 載入/送出 fallback「來去逛逛」、粉專/IG 現況說明、fallback 組 Badge 文案、送出按鈕依 preflight.canSubmit 禁用 | 修改 |
| `package.json`（或等同） | 新增 image-size（伺服器端） | 修改 |

---

## 5. 刻意沒改哪些檔案

- **左側主架構、分析區、戰情總覽、內容判讀、判讀紀錄、設定中心、素材中心主架構、投放紀錄**：本輪不動。
- **Meta 真發送、publish-service 真發送邏輯**：未做。
- **server/routes.ts 的 /api/meta/pages**：已存在且可用，本輪僅在投放頁加說明，未改 API。
- **PublishTemplate、批次建組、變體**：沿用既有，未重做。
- **Threads 或其它 publisher platform**：未實作，僅保留擴充結構。

---

## 6. 驗收步驟

1. **素材偵測**
   - 上傳一張圖片 → 建立版本後，該版本應有 detectedWidth、detectedHeight、detectedAspectRatio，detectStatus 為 success，detectSource 為 metadata；前端版本卡片顯示比例與「已偵測」。
   - 上傳一影片（主機已裝 ffprobe）→ 建立版本後應有 detectedDurationSeconds 與比例，detectSource 為 metadata；若未裝 ffprobe，應為 fallback 或 failed，比例可手動選或依檔名。
2. **主素材組建議**
   - 上傳檔名如 `產品A_版1.jpg` → 系統建議主素材組名稱或 groupId；未歸組版本在素材中心顯示「未歸組」；在投放中心選該包時，fallback 組顯示「未歸組／fallback 分組，不建議直接批次建組」。
3. **投放前檢查**
   - 開「建立草稿」→ 不選廣告帳號、不選版本 → 「建立」按鈕應禁用；選好帳號與至少一版本且版本皆有比例 → 「建立」可點；若選中僅單一比例，應出現「僅單一尺寸，建議補齊多比例（不阻擋）」；落地頁未填為警告不擋。
4. **CTA**
   - 選一素材包且其 CTA 為空或不在合法選項 → 表單 CTA 應顯示「來去逛逛」；手動選其它合法 CTA 後送出 → 草稿 CTA 正確；若手動改為不合法值（若 UI 曾允許），送出時應被改為「來去逛逛」。
5. **粉專/IG 說明**
   - 投放表單粉專/IG 區塊下方應有一段：「目前粉專／IG 清單為該 Token 下所有可用項目，尚未依所選廣告帳號精準過濾。」

---

## 7. Rollback 方式

- **還原**：將上述「本輪改了哪些檔案」所列檔案還原至本輪前版本。
- **刪除**：`server/modules/asset/detect-media.ts` 若為新增則刪除。
- **依賴**：移除 `image-size`（若僅本輪為偵測而加）。
- **資料**：既有 AssetVersion 若已寫入 detected* 等欄位，還原後 schema 若移除欄位，舊資料可能多出欄位但不影響讀取；若保留 schema 僅還原邏輯，資料可留用。

---

## 8. 風險與防呆

- **ffprobe 依賴**：影片偵測依賴主機安裝 ffmpeg；未安裝時回傳 failed，防呆為 fallback 檔名或手動選比例，不阻擋建立版本。
- **舊版本無偵測欄位**：前端與 preflight 容許 detected*、detectStatus、detectSource 為空；顯示時以「比例待確認」或既有 aspectRatio 處理。
- **CTA 非法值**：載入素材包與 formToBody 時強制收斂為「來去逛逛」，避免送出非法 CTA。
- **Preflight**：僅以帳號 + 版本 + 比例作為必過項，其餘為提示，避免過度阻擋。

---

## 9. 五點自我檢討

1. **影片偵測環境依賴**：ffprobe 未安裝時體驗降級為手動/檔名，未做「偵測服務不可用」的明顯提示，可下一輪在設定或上傳結果處加說明。
2. **主素材組建議規則單一**：目前僅檔名第一段，同一包內多產品可能混組，進階規則（如關鍵字、手動合併組）未做。
3. **Preflight 未與 API 雙向**：僅前端檢查，後端建立草稿 API 未重複驗證必填項，若直接呼叫 API 可能略過檢查。
4. **粉專/IG 與廣告帳號**：僅標示「未依廣告帳號過濾」，未做綁定表或 Meta 權限查詢，選錯組合要使用者自行注意。
5. **單一尺寸警告**：僅提示不擋，未在批次建組或版位策略上做進一步建議（例如自動標註「僅直式」）。

---

## 10. 是否偏離原本規格

**沒有。** 本輪未做 Meta 真發送、未改左側主架構與分析區、未擴新大頁面、未做無關美化、未新增無驗證價值的欄位；偵測欄位、主素材組建議、投放前檢查、CTA 收斂、粉專/IG 標示均依規格實作。

---

## 11. 下一輪建議（做完先停）

- **Preflight 與後端一致**：建立草稿 API 補齊必填與 CTA 合法檢查，與前端 preflight 一致。
- **影片偵測環境說明**：在設定或上傳流程中說明需安裝 ffmpeg，並在偵測失敗時明確提示。
- **主素材組進階**：可選依關鍵字、多檔名規則或手動合併，改善同包多產品分組。
- **粉專/IG 與廣告帳號**：若 Meta API 支援，實作依所選廣告帳號過濾粉專/IG；或提供「綁定表」讓使用者對應。
- **Threads / publisher platform**：在既有結構上擴充，不影響現有投放流程。

---

# 額外必答區

## A. 影片比例誤判：前端、後端還是兩邊都有問題？

**兩邊都曾有問題，本輪已處理。**

- **之前**：後端未讀影片 metadata，未存 detected*；前端僅能依檔名猜比例，易誤判。
- **現在**：後端在 `detect-media.ts` 用 ffprobe 讀影片 width/height/duration，寫入 detected*、detectStatus、detectSource；前端用上傳回傳的 detection 預填比例並在建立版本時寫入。若 ffprobe 未安裝或失敗，後端回傳 failed/fallback，前端改用手動或檔名 fallback。結論：誤判來源為「後端沒存 metadata + 前端只靠檔名」；本輪後端補齊 metadata 偵測並寫入，前端改為用偵測結果，僅在偵測失敗時才 fallback 檔名或手動。

---

## B. 若只上傳 9:16，系統現在是否允許建立草稿、是否有警告、是否影響版位穩定性？

- **是否允許建立草稿**：允許。只要已選廣告帳號、已選至少一素材版本、且每個版本皆有類型與比例（9:16 符合），preflight 通過，「建立」可點。
- **是否有警告**：有。投放前檢查會顯示「僅單一尺寸，建議補齊多比例（不阻擋）」。
- **是否影響版位穩定性**：不影響系統穩定性；版位會只有 9:16 一種比例，若投放設定為多版位，其它比例版位可能無對應素材，屬投放策略選擇，非系統錯誤。

---

## C. 主素材組在實作裡，到底是人工優先、系統建議優先，還是 fallback 拼湊？

**系統建議優先，使用者可改；未歸組才進 fallback。**

- 上傳後系統依**檔名第一段**（或「名稱+版」）建議主素材組名稱並預填 `groupId`，使用者可接受或手動改。
- 有歸組的版本依 `groupId` 分組顯示；**未歸組**的版本（groupId 為空）在投放中心會進入 **fallback 分組**，並標示「未歸組／fallback 分組，不建議直接批次建組」。
- 因此：**系統先建議 → 使用者再確認或修正**；不是純人工填、也不是純 fallback 拼湊，未歸組才用 fallback 分組並明確標示。

---

## D. 嚴格完成回報格式

本文件已包含：  
**1. 哪些已完成** ✓  
**2. 哪些沒完成** ✓  
**3. 哪些只是先求可用，不是最終版** ✓  
**4. 本輪改了哪些檔案** ✓  
**5. 刻意沒改哪些檔案** ✓  
**6. 驗收步驟** ✓  
**7. Rollback 方式** ✓  
**8. 風險與防呆** ✓  
**9. 五點自我檢討** ✓  
**10. 是否偏離原本規格** ✓  
**11. 下一輪建議，但做完先停** ✓  
**A. 影片比例誤判歸屬** ✓  
**B. 只上傳 9:16 的行為** ✓  
**C. 主素材組優先邏輯** ✓  
**D. 未省略已完成/未完成/驗收標準/五點檢討** ✓  

以上為本輪完成回報，做完先停，不自動進入下一輪。
