# 本輪完成回報：production verification + 可信度補驗收

---

## 1. 哪些完成

- **ffprobe production verification**
  - 新增 **GET /api/health/ffprobe**（不需登入）：執行 `ffprobe -version`，成功回傳 `{ ok: true }`，失敗回傳 `{ ok: false, error: string, code: "ENOENT"|"PERM"|"TIMEOUT"|"OTHER" }`。  
  - **失敗分類**：ENOENT = 未安裝或不在 PATH；PERM = 權限不足；TIMEOUT = 逾時；OTHER = 其他（含 JSON/串流解析錯誤等）。  
  - **detect-media.ts 失敗行為**：`detectVideoFfprobe` 拋錯或回傳 null → `detectMedia` 先試檔名推測（fallback），否則 `detectStatus: "failed"`, `detectSource: "manual"`。  
  - **UI**：版本卡 Badge「待確認」、title「比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例」。  
  - 正式環境「是否可執行」需部署後呼叫該 API 或上傳一支影片驗證；本輪已提供端點與文件。
- **manual_confirmed 嚴謹化**
  - **前端**：僅在編輯版本且 **aspectRatio 實際與原值不同** 時才送 `detectStatus: "manual_confirmed"`、`detectSource: "manual"`；只開編輯未改比例不送，避免污染。  
  - **後端**：更新版本時，若送出的 `aspectRatio` 與既有相同，自 patch 移除 `detectStatus`、`detectSource` 再寫入，避免誤覆蓋。
- **groupSource 規則固定**
  - **文件**：`docs/groupSource與偵測狀態規則.md` 明確定義 suggested / manual 觸發條件、「一旦 manual 永遠維持 manual」、與 detectStatus/detectSource 僅在比例實際變更時寫入。  
  - **程式**：前端註解指向該文件；後端 patch 防呆同上。
- **warnings 僅來自 server**
  - 建立草稿的 warnings 僅由 **publish-service** 產出並隨 201 回傳；前端 **只顯示 response 裡的 warnings** 做 toast，不在此處自算。  
  - 前後端註解已標明「warnings 唯一來源為 server，前端不重算」。
- **驗收證據清單**
  - 已列於下方「驗收標準」與「驗收證據補齊」；實際影片 success/failed/fallback、manual_confirmed、suggested/manual/未歸組、單一尺寸 warning 需在正式或測試環境手動執行一次並留存截圖或紀錄。

---

## 2. 哪些沒完成

- **在正式環境實際上傳一支影片並驗證 metadata 寫入**：需部署後由維運／開發在該環境執行（上傳 → 檢查版本欄位 + 必要時呼叫 /api/health/ffprobe）。本輪僅提供端點與規則，未在真實 production 跑完一整條。
- **批次建立時彙總每筆 draft 的 server warnings**：目前單筆建立會顯示 server 回傳的 warnings；批次建立僅顯示「已建立 N 筆草稿」，未把每筆的 warnings 彙總顯示（可下一輪補）。

---

## 3. 哪些只是先求可用

- **/api/health/ffprobe**：只跑 `ffprobe -version`，不寫檔、不讀影片；足以判斷「能否執行」，無法涵蓋「讀真實影片檔」時權限或格式問題。若需更嚴格，可再補「寫暫存檔 + 用 ffprobe 讀一次」的檢查。
- **驗收證據**：以文件清單與手動步驟為主，未做自動化 E2E 或截圖腳本。

---

## 4. 改了哪些檔案

| 檔案 | 修改目的 | 新增/修改/刪除 |
|------|----------|----------------|
| `server/modules/asset/ffprobe-health.ts` | 新增：checkFfprobeAvailable()，依錯誤分類 ENOENT/PERM/TIMEOUT/OTHER | 新增 |
| `server/routes.ts` | 註冊 GET /api/health/ffprobe，回傳 200/503 + 上述結果 | 修改 |
| `server/modules/asset/detect-media.ts` | 註解補充：失敗原因、detectMedia 行為、UI 狀態、正式環境驗證方式 | 修改 |
| `server/modules/asset/asset-version-service.ts` | 更新版本時，若 aspectRatio 未變則自 patch 移除 detectStatus/detectSource | 修改 |
| `client/src/pages/assets.tsx` | 註解：僅比例實際修改時送 manual_confirmed；groupSource 規則指向文件 | 修改 |
| `client/src/pages/publish-placeholder.tsx` | 註解：建立成功 toast 僅用 server 回傳的 warnings | 修改 |
| `server/modules/publish/publish-service.ts` | 註解：warnings 僅由此產出，前端不重算 | 修改 |
| `docs/groupSource與偵測狀態規則.md` | 明確定義 groupSource / manual_confirmed 觸發與「一旦 manual 不回頭」 | 新增 |

---

## 5. 刻意沒改哪些檔案

- **左側、分析區、Meta 真發送、批次建組新玩法、新模板大功能**：未動。
- **detect-media.ts 偵測邏輯**：僅註解，未改執行流程。
- **publish-routes / 前端 handleSubmit 回傳型別**：warnings 已由 server 附在 body，前端沿用既有讀取方式，未改介面。

---

## 6. 驗收標準

1. **GET /api/health/ffprobe**  
   - 在已安裝 ffmpeg 的環境：200 + `{ ok: true }`。  
   - 未安裝或不在 PATH：503 + `{ ok: false, error: "...", code: "ENOENT" }`。  
   - 其他錯誤依 code（PERM/TIMEOUT/OTHER）回傳。
2. **manual_confirmed**  
   - 編輯版本只改 groupId、未改比例 → 該版本 detectStatus/detectSource 不變。  
   - 編輯版本改比例 → 該版本變為 detectStatus: "manual_confirmed", detectSource: "manual"。
3. **groupSource**  
   - 新建版本帶建議 groupId → groupSource: "suggested"。  
   - 編輯時改 groupId → groupSource: "manual"，且之後不再改回 suggested。
4. **warnings**  
   - 單筆建立草稿、僅單一比例 → 201 body 含 `warnings: ["僅單一尺寸，建議補齊多比例"]`，前端 toast 顯示該句（且非前端自算）。
5. **驗收證據補齊**（建議手動執行並留存）：  
   - 一支影片 **success** 偵測：上傳後版本有 detectedWidth/Height/AspectRatio、detectStatus: success、detectSource: metadata、aspectRatio 正確。  
   - 一支影片 **failed 或 fallback**：無 ffprobe 或檔名無比例時為 failed；檔名如 9x16 時為 fallback。  
   - 一筆 **manual_confirmed**：編輯版本只改比例後存檔，該版本為 manual_confirmed + manual。  
   - 一筆 **suggested** group：新建版本帶建議 groupId，該版本 groupSource: suggested。  
   - 一筆 **manual** group：編輯版本改 groupId 後，該版本 groupSource: manual。  
   - 一筆 **未歸組**：版本無 groupId，素材中心與投放中心顯示「未歸組」。  
   - **單一尺寸建立 draft 的 warning**：只選一個比例的版本建立草稿，toast 出現「僅單一尺寸，建議補齊多比例」。

---

## 7. Rollback

- **還原**：上述「改了哪些檔案」所列檔案還原至本輪前。  
- **刪除**：`server/modules/asset/ffprobe-health.ts`、`docs/groupSource與偵測狀態規則.md`。  
- **資料**：無 schema 或資料格式變更；既有版本與草稿不受影響。

---

## 8. 風險與防呆

- **ffprobe 僅檢查 -version**：正式環境若「能跑 -version 但讀某影片失敗」，需再看 detect-media 的 catch 或日誌；必要時可補「寫暫存檔 + 讀一支樣本」的進階檢查。  
- **防呆**：後端更新版本時已避免「未改比例卻覆蓋偵測狀態」；前端僅在比例實際變更時送 manual_confirmed。

---

## 9. 五點自我檢討

1. **正式環境未實際跑完一支影片**：僅提供 /api/health/ffprobe 與文件，未在 production 上傳影片並查 DB/UI 紀錄。  
2. **批次建立未顯示每筆 warnings**：多筆建立時未彙總 server 回傳的 warnings，使用者可能漏看單一尺寸等提示。  
3. **groupSource「建議」語意**：仍以「新建時有帶 groupId」為 suggested，若日後要區分「系統建議 vs 使用者手選同組」需再加欄位或規則。  
4. **health 端點未加 rate limit**：若被大量呼叫可能造成負載，可之後加節流或僅限內網。  
5. **驗收證據依賴手動**：未做自動化腳本或 E2E，需人工執行清單並截圖/紀錄。

---

## 10. 是否偏離規格

**沒有。** 本輪未做 Meta 真發送、未改左側/分析區、未擴批次建組或新模板；以 production verification 與可信度補驗收為主，ffprobe 驗證、manual_confirmed 嚴謹化、groupSource 規則、warnings 單一來源、驗收證據清單均依目標完成。

---

## 11. 下一輪建議

- 在正式環境執行：呼叫 GET /api/health/ffprobe、上傳至少一支影片、確認 metadata 與 detectStatus/detectSource/aspectRatio 寫入正確，並留存一組驗收證據（截圖或紀錄）。  
- 批次建立時彙總並顯示各筆 server 回傳的 warnings。  
- 若有需要，可為 /api/health/ffprobe 加 rate limit 或僅允許內網。

---

# 額外必答

## A. ffprobe 在正式環境是否已實際驗證可用

**尚未在正式環境驗證。** 本輪已完成：  
- **GET /api/health/ffprobe**：正式環境部署後可呼叫，依回傳 `ok` / `code` 判斷是否可執行、以及失敗為安裝(PATH)、權限、逾時或其它。  
- **文件與註解**：detect-media 與 ffprobe-health 已說明失敗時 detect-media 行為與 UI 狀態。  
實際「可用」需在該環境執行上述 API 並（建議）上傳一支影片檢查寫入結果；本機若未裝 ffprobe 會得到 ENOENT，可先以此驗證端點行為。

---

## B. detectStatus / detectSource / groupSource 是否已不存在「誤升級／誤覆蓋」問題

**已避免。**  
- **detectStatus / detectSource**：僅在「編輯且比例實際變更」時由前端送出；後端若收到 patch 中 aspectRatio 與既有相同，會移除 patch 內的 detectStatus、detectSource 再寫入，故不會被誤覆蓋。  
- **groupSource**：僅在新建時可為 suggested；編輯時只要 groupId 有變更即送 manual，且從未在更新時把 manual 改回 suggested，因此不會誤升級或誤覆蓋。

---

## C. warnings 是否確定為 server 回傳而非前端自算

**是。**  
- 建立草稿的 warnings **只**在 **publish-service** 的 createDraft 中產出，並隨 201 的 body 回傳（`{ ...draft, warnings: string[] }`）。  
- 前端建立成功後的 toast 文案**僅**使用 `result.data.warnings`（即 response 裡的陣列），不在前端重算單一尺寸等條件；前後端註解已標明「warnings 唯一來源為 server」。

---

## D. 目前整條影片偵測鏈路是否可以稱為「已閉環」，若不能，缺最後哪一步

**尚差「正式環境實測」一步才算完全閉環。**  
目前鏈路：  
上傳影片 → detect-media（ffprobe）→ 成功則寫入 metadata + success/metadata → 失敗則 fallback 或 failed → 前端顯示 Badge／title → 使用者可手動改比例 → 寫入 manual_confirmed。  
**缺的最後一步**：在**正式環境**實際執行「上傳至少一支影片」，確認：  
1. 該環境 GET /api/health/ffprobe 為 ok，或若為 not ok 時錯誤類型與文件一致；  
2. 上傳後該版本在 DB/API 中具正確 detected*、detectStatus、detectSource、aspectRatio；  
3. UI 顯示與上述狀態一致。  
完成上述後，整條影片偵測鏈路可稱為已閉環。
