# Phase E.1 完成回報：批次建組邏輯修正

---

## 1. 這一階段到底解決了什麼痛點

- **分組從「依比例」改為「依主素材」**：同一主素材的不同尺寸（例如 A 的 9:16 + 4:5）會被分在**同一組**，一組一筆草稿；不再出現「所有 9:16 一組、所有 4:5 一組」的錯誤切法。
- **分組優先順序**：有 `parsedAssetName` + `parsedVariantCode` 時依兩者分組；沒有則用檔名規則或 `versionNote` 推測；**最後**才 fallback 到依比例分組；比例僅作 fallback，不當主要依據。
- **批次建組預覽**：改為顯示「主素材組」（如 A版（含 9:16 / 4:5）），每組底下顯示該組比例、版本數、檔名；fallback 組明確標示「此組為 fallback 分組，建議手動確認」。
- **命名支援 variant**：命名範本支援 `{variant}`（主素材組代號），預設範本改為 `{product}_{variant}_{date}_{seq}`，優先吃 product / variant / date / seq / prefix，不再只靠 ratio。
- **快速變體承接分組**：變體可「快速填入：選擇主素材組」，一次帶入該組所有版本，換的是「主素材組」而非只換比例。

---

## 2. 實際改了哪些檔案

| 檔案 | 變更摘要 |
|------|----------|
| `shared/schema.ts` | `AssetVersion` 新增選填欄位 `parsedAssetName?`、`parsedVariantCode?`。 |
| `server/modules/asset/asset-version.schema.ts` | 建立/更新 Zod schema 新增 `parsedAssetName`、`parsedVariantCode`（optional）。 |
| `server/modules/asset/asset-version-service.ts` | `create` 時將 `parsedAssetName`、`parsedVariantCode` 寫入版本。 |
| `client/src/pages/publish-placeholder.tsx` | 新增 `getVersionGroupInfo()`（主素材 key/label/fallback）；`batchGroups` 改為依主素材 key 分組，產出 `BatchGroupByAsset`（groupKey, label, versionIds, ratios, isFallback, versions）；狀態改為 `selectedBatchGroupKeys`；`applyNamingTemplate` 支援 `{variant}`，預設範本改為 `{product}_{variant}_{date}_{seq}`；`handleBatchCreate` 依選中的主素材組建立、命名時帶入 variant；批次建組 UI 改為主素材組卡片（含比例、版本數、檔名、fallback 標示）；選素材版本區新增「快速填入：選擇主素材組」按鈕列，供變體時一鍵帶入某主素材組。 |

**未改**：左側主架構、分析區、素材中心、投放紀錄、Meta 真發送。

---

## 3. 哪些檔案刻意沒動

- 左側導覽、戰情總覽、FB/GA 分析、內容判讀、判讀紀錄、設定中心、素材中心、投放紀錄。
- 素材中心上傳/建立版本流程：尚未在 UI 填寫或寫入 `parsedAssetName` / `parsedVariantCode`，目前依檔名與 versionNote 推測或 fallback 比例。
- Meta 實際發送、範本 CRUD 其他行為。

---

## 4. 目前使用者操作流程變成什麼

1. **單筆建立**：與 Phase E 相同；命名可吃 `{variant}`（若範本有設）。
2. **批次建組**：選素材包 → 版本列表下方「批次建組」改為**依主素材分組**（例如 A版（含 9:16/4:5）、B版（含 9:16/4:5）、C版（含 9:16/1:1））；每組顯示比例、版本數、檔名，fallback 組有警示；勾選要建立的組 → 填帳號與預算（可從範本載入）→「一次建立 N 筆草稿」→ 每筆草稿對應一組 versionIds，命名依 `{product}_{variant}_{date}_{seq}` 或範本產生（variant = 主素材組代號）。
3. **快速變體**：草稿列點「變體」→ 表單帶入原設定、清空版本與名稱；在「選素材版本」區可點「快速填入：選擇主素材組」某組（如 B版）→ 一次帶入該組所有版本 → 建立，即換成另一主素材組。
4. **範本**：同 Phase E；命名範本若含 `{variant}`，批次建立時會帶入主素材組代號。

---

## 5. Acceptance steps

1. 素材包內版本若有 `parsedAssetName` + `parsedVariantCode`（或檔名規則可推測）→ 批次建組應依主素材分組（例如 A 的 9:16+4:5 一組、B 的 9:16+4:5 一組），而非依比例分成 9:16 一組、4:5 一組。
2. 勾選兩組主素材組 →「一次建立 2 筆草稿」→ 產生 2 筆草稿，每筆的 `selectedVersionIds` 為該主素材組內所有 versionIds；命名應含 variant（主素材組代號）。
3. Fallback 組（僅能依檔名推測或依比例）在 UI 顯示「此組為 fallback 分組，建議手動確認」。
4. 點「變體」→ 在「快速填入：選擇主素材組」選另一組（如 B版）→ 該組版本被勾選 → 建立後新草稿為 B 組素材。
5. 命名範本使用 `{product}_{variant}_{date}_{seq}` 時，批次建立名稱應出現 variant 而非僅 ratio。

---

## 6. Rollback

- 還原 `shared/schema.ts`、`server/modules/asset/asset-version.schema.ts`、`server/modules/asset/asset-version-service.ts`、`client/src/pages/publish-placeholder.tsx` 至 Phase E.1 前。
- 無 DB migration；`AssetVersion` 新增欄位為 optional，舊資料仍可跑，僅無 parsed 時走檔名/versionNote/比例 fallback。

---

## 7. 風險與防呆

- **parsed 欄位**：素材中心尚未提供 UI 填寫，多數版本仍靠檔名或 versionNote 推測；推測規則為「檔名去副檔名、以 _-. 分割、第一段主素材、第二段變體」，與實際命名習慣不符時會錯組，故 fallback 組一律標示建議手動確認。
- **批次建立**：仍為前端多次 POST；單筆失敗不影響已成功筆數，失敗明細未列出。
- **variant 字元**：命名用 variant 時會替換空白與 `/` 為 `_`、截斷 32 字，避免檔名非法字元。

---

## 8. 自我檢查後，最可能還殘留的 5 個問題

1. **parsed 來源**：`parsedAssetName` / `parsedVariantCode` 尚未在素材中心建立/編輯版本時寫入，需後續在素材中心表單或上傳流程中提供欄位或自動解析。
2. **檔名推測規則固定**：目前僅支援「第一段=主素材、第二段=變體」的檔名規則，其他命名習慣（如日期在前、多底線）可能分錯組。
3. **批次建立失敗明細**：某筆 POST 失敗時前端未列出哪一筆、何原因，僅 toast 顯示成功筆數。
4. **範本命名自訂**：儲存範本時命名範本字串仍為後端/前端預設，使用者無法在 UI 自訂範本字串再存。
5. **fallback 準確度**：僅依 versionNote 時用前 50 字做 key、前 20 字做 label，若多筆版本 note 相同會併成一組，可能非預期。

---

## 9. 有沒有偏離「不動左邊分析主架構」這條原則

**沒有。** 僅改動 schema、asset-version 後端欄位與投放中心頁；未動左側導覽、戰情總覽、FB/GA 分析、內容判讀、判讀紀錄、設定中心、素材中心；未做 Meta 實際發送。

---

## 10. 下一階段準備做什麼（先不要動，等你看完再說）

下一階段可做：素材中心建立/編輯版本時支援 `parsedAssetName` / `parsedVariantCode`（或上傳時依檔名自動帶入）；範本命名自訂 UI；批次建立失敗明細回報；更彈性的檔名推測規則或自訂分組規則。  
不自動進入下一階段，等你確認後再動。

---

## A. 你怎麼定義「主素材分組 key」

- **使用哪些欄位組 key**  
  - **優先**：`parsedAssetName` + `parsedVariantCode`（兩者皆非空）→ key = `p:{parsedAssetName}\t{parsedVariantCode}`，label = `{parsedAssetName}（{parsedVariantCode}）`，**不**標為 fallback。  
  - 僅有 `parsedAssetName`：key = `p:{parsedAssetName}\t`，label = parsedAssetName，不標 fallback。  
  - **次之**：兩者都無時，用**檔名**推測：檔名去副檔名，以 `_`、`-`、`.` 分割，**第一段當主素材**，key = `f:{assetName}`（同一主素材不同尺寸同組），label = assetName，**標為 fallback**。  
  - 檔名無法推測（空）時，用 **versionNote** 前 50 字做 key、前 20 字做 label，key = `n:{note}`，**標為 fallback**。  
  - **最後**：以上皆無時，**依比例分組**，key = `r:{aspectRatio}`，label = `{aspectRatio} 比例組`，**標為 fallback**。

- **欄位缺失時怎麼 fallback**  
  - 缺少 `parsedAssetName` 或 `parsedVariantCode`（或為空）→ 不採用 parsed，改走檔名推測；檔名無效則 versionNote；再無則比例。

- **哪些情況會退回比例分組**  
  - 僅當「無 parsed、檔名去副檔名後為空、且 versionNote 為空」時，該版本會以 `r:{aspectRatio}` 分組，與同比例且同樣條件的版本併成「比例組」，並標示「此組為 fallback 分組，建議手動確認」。

---

## B. 請給 3 組真實例子

假設同一素材包內有 6 個版本：

- **A 素材**：versionId = v1（9:16）、v2（4:5），檔名為 `A_9x16.mp4`、`A_4x5.jpg`（或兩筆皆有 parsedAssetName=A, parsedVariantCode=A）  
- **B 素材**：versionId = v3（9:16）、v4（4:5），檔名為 `B_9x16.mp4`、`B_4x5.jpg`  
- **C 素材**：versionId = v5（9:16）、v6（1:1），檔名為 `C_9x16.mp4`、`C_1x1.jpg`

**系統最後分幾組**  
- 3 組（A 組、B 組、C 組）。若無 parsed，則由檔名推測：檔名第一段為 A/B/C，key 僅用主素材名（f:A、f:B、f:C），故 A_9x16 與 A_4x5 同屬 A 組。

**每組有哪些 versionIds**  
- A 組：`[v1, v2]`  
- B 組：`[v3, v4]`  
- C 組：`[v5, v6]`

**命名怎麼產生**  
- 預設範本 `{product}_{variant}_{date}_{seq}`；product = 素材包名稱，date = 當日 YYYYMMDD，variant = 主素材組 label 轉成 slug（如 A、B、C 或 A_9x16、B_9x16、C_9x16 依實際 label），seq = 1,2,3。  
- 例如：第 1 筆草稿（A 組）→ `ProductName_A_20250303_1`；第 2 筆（B 組）→ `ProductName_B_20250303_2`；第 3 筆（C 組）→ `ProductName_C_20250303_3`。  
- 若範本仍含 `{ratio}`，則用該組第一個比例填入（例如 A 組為 9:16）。

---

## C. 這輪修正後，哪裡才開始真正接近投手實務

- **流程上**：投手手上是「同一支創意、多尺寸」（例如 A 版 9:16 + 4:5），要的是「一組廣告用 A 版多尺寸」，而不是「所有 9:16 一組、所有 4:5 一組」；這輪後系統依主素材成組，勾選一組就等於選了「這支創意的所有尺寸」，一次建立一筆草稿、對應一組 versionIds，送 Meta 時才不會送錯組。  
- **變體**：投手常做「同一設定、換另一支創意」，現在可以用「變體」＋「快速填入：選擇主素材組」直接換成 B 組或 C 組，不必手動一個一個勾版本。  
- **命名**：campaign / ad set / ad 名稱會帶主素材組代號（variant），之後在 Meta 後台或報表較容易對應「哪一組是哪支創意」，減少對錯組的機率。

---

## D. 這輪還有哪些地方只是先求可用，不是最終版

- **parsed 欄位依賴度**：目前多數版本沒有 parsed，依賴檔名與 versionNote 推測；準確度取決於命名習慣。最終版應在素材中心建立/上傳時就寫入或自動解析 parsed，減少 fallback。  
- **fallback 準確度**：檔名規則固定（第一段主素材、第二段變體），其他命名方式可能分錯；versionNote 若多筆相同會併組。之後可考慮可設定的檔名規則或手動指定主素材組。  
- **批次建立失敗明細**：未列出哪一筆失敗、錯誤訊息為何，只知成功筆數；之後應在 UI 回報失敗的組與原因。  
- **範本命名自訂程度**：命名範本仍為預設或範本儲存時帶的欄位，使用者尚無法在畫面上自訂「我要的範本字串」再存成範本，僅能選現成範本；之後可做範本編輯與自訂命名範本字串。
