# 本輪完成回報：偵測可信度分級、後端保底驗證、主素材組可視化

---

## 1. 哪些完成

- **偵測可信度分級與顯示**
  - `detectStatus` 區分：success / fallback / failed / manual_confirmed；`detectSource` 區分：metadata / filename / manual。
  - 素材中心版本卡：以 Badge 顯示「真偵測」「已確認」「推測」「待確認」，並依狀態上色；hover 顯示說明（failed 時提示 ffprobe／手動選擇）。
  - 投放中心版本區：每筆版本同樣以 Badge 顯示偵測狀態，一眼可辨「真抓到／人工確認／fallback 推測」。
- **後端保底驗證（建立 draft）**
  - 建立草稿 API 驗證：accountId 必填（schema）、selectedVersionIds 必存在且權限正確、每筆版本皆有 aspectRatio，缺一則 400。
  - CTA 不合法或未填時，server 強制改為「來去逛逛」再寫入。
  - 單一尺寸不擋，但在回應中附 `warnings: ["僅單一尺寸，建議補齊多比例"]`；前端建立成功後 toast 顯示該提示。
- **主素材組狀態可視化**
  - 版本卡與批次建組：以 Badge 明確標「系統建議」「人工指定」「未歸組」；fallback 組標「未歸組」＋說明「fallback 分組，不建議直接批次建組」。
  - 快速填入主素材組按鈕旁也顯示「建議／人工／未歸組」。
- **ffprobe 失敗時 UI 提示**
  - 偵測失敗（detectStatus: failed）時，Badge title 提示：「比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例」；detect-media.ts 註解說明正式環境需部署後驗證。
- **粉專／IG／廣告帳號「不誤導」**
  - 保留「目前粉專／IG 清單為該 Token 下所有可用項目，尚未依所選廣告帳號精準過濾」。
  - 當已選廣告帳號時，另顯示：「提醒：目前尚未依所選廣告帳號精準綁定粉專／IG，請自行確認對應關係。」
- **manual_confirmed 與 groupSource**
  - Schema 與 version API 支援 detectStatus: manual_confirmed、groupSource: suggested | manual；使用者編輯版本改比例時寫入 manual_confirmed，改主素材組時寫入 groupSource: manual。

---

## 2. 哪些沒完成

- **正式環境 ffprobe 實際執行驗證**：未在真實正式機上跑 ffprobe，僅補齊失敗時 UI 提示與註解說明，需部署後由維運／開發自行驗證。
- **依廣告帳號精準過濾粉專／IG**：未實作，僅標示現況與帳號級提醒。
- **Threads 真正投放、Meta 真發送、左側／分析區變更**：依本輪規定未做。

---

## 3. 哪些只是先求可用

- **主素材組「系統建議」判定**：目前以「建立版本時有帶入建議的 groupId 且未改」記為 suggested；若使用者先清空再選同組會變成 manual，邏輯可之後再細調。
- **後端 CTA 白名單**：與前端 META_CTA_OPTIONS 手動同步，未抽成共用常數，之後可遷到 shared。
- **單一尺寸 warning**：僅在建立草稿回應中帶 warnings，未在草稿列表或編輯時持續顯示。

---

## 4. 改了哪些檔案

| 檔案 | 修改目的 | 新增/修改/刪除 |
|------|----------|----------------|
| `shared/schema.ts` | AssetVersion：detectStatus 新增 manual_confirmed；新增 groupSource（suggested / manual） | 修改 |
| `server/modules/asset/asset-version.schema.ts` | detectStatus 列舉加入 manual_confirmed；新增 groupSource 選填 | 修改 |
| `server/modules/asset/asset-version-service.ts` | 建立版本時寫入 groupSource | 修改 |
| `server/modules/asset/detect-media.ts` | 註解補充 ffprobe 正式環境與失敗時行為、前端提示說明 | 修改 |
| `server/modules/publish/publish-service.ts` | META_CTA_OPTIONS；建立 draft 前驗證版本存在、每筆有 aspectRatio；CTA 非法改為「來去逛逛」；成功時依比例數附 warnings | 修改 |
| `server/modules/publish/publish-routes.ts` | POST /drafts 成功時若有 warnings 一併回傳於 body | 修改 |
| `client/src/pages/assets.tsx` | 版本卡：偵測 Badge（真偵測/已確認/推測/待確認）、groupSource Badge（建議組/人工組）、未歸組 Badge；建立/編輯時寫入 groupSource、編輯改比例寫入 manual_confirmed；failed 時 title 提示 ffprobe | 修改 |
| `client/src/pages/publish-placeholder.tsx` | 版本區偵測 Badge；批次建組與快速填入之 Badge（系統建議/人工指定/未歸組）；建立成功後顯示 API 回傳之 warnings；已選廣告帳號時顯示粉專/IG 綁定提醒 | 修改 |

---

## 5. 刻意沒改哪些檔案

- **左側導覽、戰情總覽、分析區、內容判讀、判讀紀錄、設定中心、投放紀錄**：本輪不動。
- **Meta 真發送、Threads、publish 實際發送邏輯**：未改。
- **/api/meta/pages**：沿用既有，僅在投放表單加說明與提醒，未改 API。
- **detect-media 偵測邏輯**：僅加註解，未改執行流程。

---

## 6. 驗收標準

1. **偵測可信度**
   - 素材中心：版本卡上出現「真偵測／已確認／推測／待確認」Badge，且 failed 時 hover 出現 ffprobe／手動選擇提示。
   - 投放中心：選版本後，版本列表每筆有對應偵測狀態 Badge。
2. **後端保底**
   - 不選廣告帳號或未選版本送建立 → 400（或 schema 驗證錯誤）。
   - 所選版本中若有任一流失 aspectRatio（或後端查無該版本）→ 400「所選素材版本須皆有比例」。
   - CTA 送非法值 → 草稿仍建立，但 cta 存為「來去逛逛」。
   - 僅選單一比例版本建立 → 201 且回應含 warnings：["僅單一尺寸，建議補齊多比例"]，前端 toast 顯示該提示。
3. **主素材組可視化**
   - 素材中心：有 groupId 的版本顯示「建議組」或「人工組」，無 groupId 顯示「未歸組」。
   - 投放中心：批次建組與快速填入按鈕旁／清單上可辨「系統建議／人工指定／未歸組」。
4. **粉專／IG**
   - 已選廣告帳號時，表單顯示「目前尚未依所選廣告帳號精準綁定粉專／IG…」提醒。

---

## 7. Rollback

- **還原**：上述「改了哪些檔案」所列檔案還原至本輪前版本。
- **無新增檔案**：無需刪除新檔。
- **資料**：既有版本若已寫入 groupSource／manual_confirmed，還原後 schema 仍可保留欄位；若移除欄位，舊資料多出的鍵不影響讀取。
- **API 行為**：還原後建立草稿不再做 aspectRatio／CTA 保底與 warnings。

---

## 8. 風險與防呆

- **ffprobe 依賴**：正式環境未驗證時，影片偵測可能多為 failed；已以 UI 提示與註解說明，防呆為手動選比例或 manual_confirmed。
- **CTA 白名單**：前後端需手動同步 META_CTA_OPTIONS，否則可能誤判非法或漏判。
- **groupSource 語意**：目前「建議」僅代表建立時帶入建議 groupId；若日後改為「最後一次變更來源」需再調整邏輯。

---

## 9. 五點自我檢討

1. **ffprobe 未在正式環境實測**：僅文檔與 UI 提示，實際可用性需部署後驗證。
2. **主素材組「建議」與「人工」**：邊界情況（如清空再選同組）可能標成人工，語意可再收斂。
3. **單一尺寸 warning**：僅在建立當下回應與 toast 出現，草稿列表不顯示，若需長期提醒要另做。
4. **META_CTA_OPTIONS 重複**：前後端各一份，日後應抽成 shared 常數避免不一致。
5. **updateDraft**：本輪僅加強 createDraft 驗證，更新草稿未重做 CTA／版本比例保底，若直接呼叫 PUT 仍可能寫入非法 CTA。

---

## 10. 是否偏離規格

**沒有。** 未做 Meta 真發送、未改左側與分析區、未擴 Threads、未加無關大功能；偵測分級、後端保底、主素材組可視化、ffprobe 提示、粉專/IG 不誤導均依本輪目標實作。

---

## 11. 下一輪建議

- **正式環境驗證 ffprobe**：在實際部署環境執行影片上傳，確認 detectStatus 為 success 或正確 fallback／failed，並確認 UI 提示正確。
- **建立草稿 API 與前端 CTA 常數共用**：將 META_CTA_OPTIONS 移至 shared，前後端共用，減少不同步風險。
- **updateDraft 保底**：更新草稿時同樣驗證 CTA 合法、所選版本存在且具 aspectRatio，與 createDraft 一致。
- **依廣告帳號過濾粉專/IG**：若 Meta API 支援，再實作「依所選廣告帳號取得/過濾粉專與 IG」。

---

# 額外必答

## A. ffprobe 在正式環境是否已驗證可用

**尚未。** 本輪僅補齊：  
- 偵測失敗時 `detectStatus: "failed"` 與 UI Badge「待確認」及 title「比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例」；  
- detect-media.ts 註解說明正式環境需安裝 ffmpeg 且部署後應實際驗證。  
正式環境是否真的能執行 ffprobe、失敗時行為是否如預期，需在該環境部署後由維運／開發實際驗證。

---

## B. aspectRatio 現在在 server 端到底是「真實偵測 / 人工確認 / fallback 推測」哪種都能區分嗎

**能區分。**  
- 版本資料存有 `detectStatus`（success / fallback / failed / manual_confirmed）與 `detectSource`（metadata / filename / manual）。  
- **真實偵測**：detectStatus === "success"，通常 detectSource === "metadata"。  
- **人工確認**：detectStatus === "manual_confirmed"，detectSource === "manual"（使用者編輯比例後寫入）。  
- **fallback 推測**：detectStatus === "fallback"，通常 detectSource === "filename"。  
- **未取得／待手動**：detectStatus === "failed"。  
建立草稿時 server 只驗證「每筆版本皆有 aspectRatio」，未強制區分來源；若日後要依可信度阻擋或再提示，可讀取版本之 detectStatus／detectSource 判斷。

---

## C. draft 建立 API 現在是否已經有 server-side 保底驗證，而不只是前端禁按鈕

**是。**  
- accountId：schema 必填（min(1)）。  
- selectedVersionIds：必存在且每筆版本皆存在且屬該使用者（ensureVersionsExist）。  
- 每筆版本皆有 aspectRatio：建立前查出版本實體，任一無 aspectRatio 即 400「所選素材版本須皆有比例」。  
- CTA：若未填或不在 META_CTA_OPTIONS，強制改為「來去逛逛」再寫入草稿。  
- 單一尺寸：不擋，成功回應帶 `warnings: ["僅單一尺寸，建議補齊多比例"]`。  
以上皆在 server 執行，不依賴前端禁按鈕。

---

## D. 主素材組目前是否能一眼分辨人工組與 fallback 組

**能。**  
- **素材中心**：有 groupId 的版本會顯示 Badge「建議組」或「人工組」（依 groupSource）；無 groupId 顯示「未歸組」。  
- **投放中心**：  
  - 快速填入按鈕旁：非 fallback 顯示「建議」或「人工」，fallback 顯示「未歸組」。  
  - 批次建組清單：非 fallback 顯示 Badge「系統建議」或「人工指定」，fallback 顯示「未歸組」並搭配說明「fallback 分組，不建議直接批次建組」。  
因此可一眼分辨「系統建議／人工指定／未歸組（fallback）」。
