# Phase E 完成回報

---

## 1. 這一階段到底解決了什麼痛點

- **批次建組**：同一素材包內依**比例**自動分組（9:16、1:1、4:5 等），使用者勾選要建立的組別後，一次建立多筆草稿，每筆草稿對應一組 versionIds，不再一筆一筆手動選版本、複製、改名稱。
- **自動命名**：支援範本佔位 `{product}`、`{date}`、`{ratio}`、`{seq}`、`{prefix}`；批次建立時依序產生 campaign / ad set / ad 名稱，使用者可在範本中覆寫規則。
- **快速變體**：草稿列表新增「變體」按鈕，複製為變體後沿用帳號、預算、受眾、placement、文案，只清空版本與名稱，讓投手只換素材組即可產出新草稿。
- **模板化**：新增投放範本（PublishTemplate）：可儲存帳號、預算、受眾、CTA、網址、命名範本；建立草稿時可「從範本載入」，不必每次重設；進階選項內可「將目前設定儲存為範本」。
- **粉專 / IG 可搜尋下拉**：後端新增 GET `/api/meta/pages`（用 fbAccessToken 呼叫 Meta Graph `me/accounts`），回傳粉專與 IG 帳號；投放表單中粉專、IG 改為可搜尋下拉（Popover + Command），無 token 時仍顯示輸入框與說明。

---

## 2. 實際改了哪些檔案

| 檔案 | 變更摘要 |
|------|----------|
| `server/routes.ts` | 新增 GET `/api/meta/pages`：以 fbAccessToken 呼叫 Meta `me/accounts?fields=id,name,instagram_business_account{id,username}`，回傳 `{ pages, igAccounts }`。 |
| `shared/schema.ts` | 新增 `PublishTemplate` 介面（id, userId, name, accountId, pageId, igAccountId, budgetDaily, budgetTotal, audienceStrategy, placementStrategy, cta, landingPageUrl, campaignNameTemplate, adSetNameTemplate, adNameTemplate, createdAt）。 |
| `server/modules/publish/publish-template-repository.ts` | 新增：以 JSON 檔儲存範本、listByUserId / getById / create / remove。 |
| `server/modules/publish/publish-routes.ts` | 新增 GET `/templates`、POST `/templates`、DELETE `/templates/:id`。 |
| `client/src/pages/publish-placeholder.tsx` | 新增 useQuery `/api/meta/pages`、`/api/publish/templates`；`batchGroups`（依比例分組）、`selectedBatchGroupRatios`、`batchCreating`、`selectedTemplateId`；`applyNamingTemplate`；`loadTemplate`、`handleBatchCreate`、`openCopyAsVariant`；投放設定區「從範本載入」下拉；粉專/IG 改為 Popover+Command 可搜尋下拉；選素材版本區下方「批次建組」卡（勾選比例組、一次建立 N 筆草稿）；進階選項內「將目前設定儲存為範本」；草稿列「變體」按鈕。 |

**未改**：左側主架構、分析區、素材中心、投放紀錄、Meta 實際發送。

---

## 3. 哪些檔案刻意沒動

- 左側導覽、戰情總覽、FB/GA 分析、內容判讀、判讀紀錄、設定中心、素材中心、投放紀錄。
- `publish-service.ts`、`publish.schema.ts`（draft 建立仍為單筆 API，批次由前端多次 POST）。
- Meta 實際發送、廣告帳號與粉專/IG 的綁定關係（目前粉專/IG 為使用者 token 下之清單，未依所選廣告帳號過濾，可之後補）。

---

## 4. 目前使用者操作流程變成什麼

1. **單筆建立**：與 Phase D 相同；可選「從範本載入」帶入預算、受眾、CTA、命名規則；粉專/IG 可從下拉選（需已綁定 Meta）。
2. **批次建組**：選素材包 → 版本列表下方出現「批次建組」、依比例分組（如 9:16 三支、1:1 兩支）；勾選要建立的組 → 填好帳號與預算（可從範本載入）→ 點「一次建立 N 筆草稿」→ 系統依序建立 N 筆草稿，每筆一組 versionIds、名稱依範本或預設 `{product}_{date}_{ratio}_{seq}` 產生。
3. **快速變體**：在草稿列點「變體」→ 表單帶入原草稿設定、清空版本與名稱 → 只選新素材組、必要時改名稱 → 建立。
4. **範本**：在進階選項點「將目前設定儲存為範本」→ 輸入名稱 → 之後建立草稿時可選「從範本載入」套用。

---

## 5. Acceptance steps

1. 選一素材包且有多個版本、多種比例 → 下方出現「批次建組」、列出各比例與支數；勾選兩組 → 出現「一次建立 2 筆草稿」；點擊後應建立 2 筆草稿，每筆對應一組 versionIds。
2. 建立前選「從範本載入」某範本 → 帳號、預算、受眾、CTA 等帶入；若範本有命名範本，批次建立時名稱依範本替換。
3. 進階選項「將目前設定儲存為範本」→ 輸入名稱 → 成功後範本列表出現該筆；再開建立草稿可選該範本載入。
4. 草稿列點「變體」→ 表單為原草稿設定、selectedVersionIds 與名稱為空；選新版本後建立 → 產生新草稿。
5. 設定已綁定 Meta token 時，投放表單粉專/IG 為可搜尋下拉；選粉專或 IG 後可送出。

---

## 6. Rollback

- 還原 `server/routes.ts`、`shared/schema.ts`、`server/modules/publish/publish-template-repository.ts`、`server/modules/publish/publish-routes.ts`、`client/src/pages/publish-placeholder.tsx` 至 Phase E 前。
- 刪除 `.data/publish-templates.json` 若已存在。
- 無 DB migration，僅檔案與 API 變更。

---

## 7. 風險與防呆

- **Meta /api/meta/pages**：依賴設定中的 fbAccessToken；token 過期或權限不足時 API 可能失敗，前端已處理為無資料時顯示輸入框與說明。
- **批次建立**：前端迴圈 POST，若勾選組數很多會有多次請求；單次失敗不影響已成功筆數，最後 toast 顯示「已建立 N 筆草稿」。
- **範本命名**：儲存範本用 `window.prompt` 輸入名稱，未做重複名稱檢查。
- **粉專/IG 與廣告帳號**：目前未依所選廣告帳號過濾粉專/IG 清單，清單為該 token 下全部；若未來要綁定「某廣告帳號對應某粉專」可再補。

---

## 8. 自我檢查後，最可能還殘留的 5 個問題

1. **分組僅依比例**：目前依 `aspectRatio` 分組，未依「主素材」或檔名規則分組，同一比例多支會全進同一組。
2. **範本管理**：僅能儲存與載入，無法編輯、刪除範本（後端有 DELETE，前端未做列表與刪除按鈕）。
3. **批次建立失敗明細**：若其中一筆 POST 失敗，僅在後台可察覺，前端未列出哪一筆失敗。
4. **粉專/IG 與帳號對應**：未依廣告帳號過濾，可能選到與當前廣告帳號無關的粉專/IG。
5. **命名範本僅預設**：儲存範本時固定寫死 `{product}_{date}_{ratio}_{seq}`，未讓使用者自訂範本字串再存。

---

## 9. 有沒有偏離「不動左邊分析主架構」這條原則

**沒有。** 僅改動投放中心頁、publish 相關後端與 schema；未動左側導覽、戰情總覽、FB/GA 分析、內容判讀、判讀紀錄、設定中心、素材中心；未做 Meta 實際發送。

---

## 10. 下一階段準備做什麼（先不要動，等你看完再說）

下一階段可做：範本列表與刪除 UI、批次建立失敗回報、依廣告帳號過濾粉專/IG（若 Meta API 支援）、主素材維度分組或自訂分組規則。  
不自動進入下一階段，等你確認後再動。

---

## A. 這一輪到底哪裡開始真正贏過 Meta 後台（投手流程）

- **在 Meta 後台**：要產出多組廣告（例如同產品、三種比例各一組），通常要：複製一筆廣告 → 改 campaign / ad set / ad 名稱 → 換素材 → 再複製再改再換，重複 N 次；名稱常手打或複製貼上，容易錯、慢。
- **在系統裡現在**：
  1. 選一個素材包、同一批版本會依**比例**自動建議分組（例如 9:16 三支、1:1 兩支、4:5 一支）。
  2. 勾選要建立的組（例如只要 9:16 和 1:1）→ 填一次帳號與預算（或從範本載入）→ 點「一次建立 2 筆草稿」。
  3. 系統自動產出 2 筆草稿：每筆對應一組 versionIds，名稱依 `{product}_{date}_{ratio}_{seq}` 或範本產生，不需手打。
  4. 若之後要「同一設定、只換素材」：點原草稿「變體」→ 只選另一組版本 → 建立，即為快速變體。

**步數對比**：Meta 後台 N 組要「複製＋改名稱＋換素材」約 3N 步以上；這裡是「選包 → 勾組 → 填一次設定 → 一次建立 N 筆」＋必要時「變體」只換素材，步數明顯少、名稱一致且可預期。

---

## B. 批次建組的建立結果（說明格式）

- **系統建議分成幾組**：依該素材包內版本的 `aspectRatio` 不重複值分組，每種比例一組。例如 6 個版本為 9:16×3、1:1×2、4:5×1 → 建議 3 組（9:16、1:1、4:5）。
- **使用者最後選幾組**：由使用者在「批次建組」區勾選；例如勾選 9:16 與 1:1 → 選 2 組。
- **最後真的建立出幾筆草稿**：與勾選組數相同；每組一筆草稿，每筆的 `selectedVersionIds` = 該組內所有版本 id。若某筆 POST 失敗，該筆不建立，其餘照常；前端 toast 顯示「已建立 N 筆草稿」（N = 成功筆數）。
- **每筆草稿對應哪些 selectedVersionIds**：第 k 筆對應第 k 個勾選組的 `versionIds` 陣列（該比例下所有版本的 id）。
- **命名是怎麼自動產的**：  
  - 若有選「從範本載入」且該範本有 `campaignNameTemplate` / `adSetNameTemplate` / `adNameTemplate`，則用 `applyNamingTemplate(template, { product, date, ratio, seq, prefix })` 替換 `{product}`、`{date}`、`{ratio}`、`{seq}`、`{prefix}` 產出該筆的 campaign / ad set / ad 名稱。  
  - 若無範本或範本無範本字串，預設為 `{product}_{date}_{ratio}_{seq}`（ad 可為 `{product}_{ratio}_{seq}`）；`product` = 素材包 `brandProductName` 或 `name`，`date` = 當日 YYYYMMDD，`ratio` = 該組比例（如 9:16），`seq` = 1,2,3...（依勾選順序）。
