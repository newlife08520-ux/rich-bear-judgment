# 本階段完成回報：主素材組正式做成一層

---

## 1. 這一階段到底解決了什麼痛點

- **投手／行銷**：同一支創意多尺寸（例如 A 版 9:16 + 4:5）不再靠「檔名推測」或「只依比例分組」亂併；先在素材中心建立「主素材組」（A版、B版），把版本歸到組裡，投放中心直接勾選「A版」「B版」一次建多筆草稿，每筆自動帶入該組所有版本，**少掉手動勾零碎版本、對錯組的風險**。
- **設計／產出**：版本建立時可指定所屬主素材組，之後在投放中心以「組」為單位操作，**不用再記檔名規則或比例對應**。
- **流程**：素材包底下有明確的「主素材組」一層，每組底下掛多尺寸版本；批次建組時以組為單位，一組一筆草稿，命名可吃組名（variant），**方向與後續一鍵送 Meta 對齊**。

---

## 2. 實際改了哪些檔案

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `server/modules/asset/asset-group-repository.ts` | 主素材組儲存：`.data/asset-groups.json`、依 userId 隔離；`listByPackageId`、`getById`、`create`、`update`、`remove`、`removeByPackageId`（刪除素材包時一併刪除其下所有組）。 |
| `server/modules/asset/asset-group-service.ts` | 主素材組服務：`listByPackage`、`get`、`create`（驗證 package 存在、name 必填）、`update`、`remove`。 |

### 修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `shared/schema.ts` | 新增 `AssetGroup` 介面（id, packageId, name, variantCode?, displayOrder?, createdAt）；`AssetVersion` 新增選填 `groupId?: string`。 |
| `server/modules/asset/asset-version.schema.ts` | 建立/更新 schema 新增 `groupId`（optional）。 |
| `server/modules/asset/asset-version-service.ts` | `create` 時將 `groupId` 寫入版本。 |
| `server/modules/asset/asset-package-service.ts` | 引入 `asset-group-repository`；`remove` 刪除素材包前呼叫 `groupRepo.removeByPackageId(userId, id)`。 |
| `server/modules/asset/asset-package-routes.ts` | 引入 `asset-group-service`；新增 GET `/:id/groups`、POST `/:id/groups`（body: name, variantCode?, displayOrder?）、PUT `/:id/groups/:groupId`、DELETE `/:id/groups/:groupId`（皆驗證 package 存在且 group 屬於該 package）。 |
| `client/src/pages/publish-placeholder.tsx` | 引入 `AssetGroup`；新增 useQuery `/api/asset-packages/:id/groups`（enabled 當有選素材包）；`batchGroups` 改為**先以 API 主素材組**產出（每組 groupKey=group.id, label=group.name, versionIds=versions.filter(v=>v.groupId===group.id)），再對**未歸組版本**用既有 getVersionGroupInfo 推測/比例 fallback 併入，並標 isFallback。 |
| `client/src/pages/assets.tsx` | 引入 `AssetGroup`；`VersionFormState` 新增 `groupId`；`emptyVersionForm`、`versionToForm` 含 groupId；新增 useQuery `/api/asset-packages/:id/groups`；新增 state `newGroupName`、`groupCreating` 與 `createAssetGroup()`（POST groups、invalidate groups 查詢）；右側面板新增「主素材組」卡（列出組 Badge、輸入名稱 +「建立主素材組」）；版本表單新增「主素材組（選填）」Select；版本卡片顯示所屬組名；`saveVersion` body 含 `groupId`，存檔後 invalidate groups 查詢。 |

---

## 3. 哪些檔案刻意沒動

- **左側主架構**：沒動。導覽、SidebarTrigger、路由結構未改。
- **分析區**：沒動。戰情總覽、FB/GA 分析、內容判讀、判讀紀錄未改。
- **素材中心**：有改。僅在既有頁面內新增「主素材組」卡、版本表單 groupId、版本列表顯示組名；未改左側列表、未改篩選/排序結構、未做「素材工廠」級大量管理或自動判斷類型/比例/時長。
- **投放中心**：有改。僅改 batchGroups 資料來源與順序（API 主素材組優先 + 未歸組 fallback）；未改左側、未改表單區塊結構、未做成「大型表單」。
- **後端 schema / route / repository**：有動。schema 新增 AssetGroup、AssetVersion.groupId；新增 group repository、service、routes；asset-package-service remove 呼叫 group removeByPackageId；asset-version schema/service 支援 groupId。其餘 publish、analysis、auth、storage 未動。

---

## 4. 哪些功能已完成

- 主素材組實體：schema `AssetGroup`、儲存與 CRUD API（GET/POST/PUT/DELETE 主素材組）。
- 版本可歸屬主素材組：`AssetVersion.groupId`、建立/更新版本可帶入 groupId；素材中心版本表單可選「主素材組」。
- 素材中心主素材組管理：選定素材包後可建立主素材組（輸入名稱、建立），列表以 Badge 顯示；版本列表顯示所屬組名。
- 投放中心批次建組以主素材組優先：選素材包後拉取該包主素材組；batchGroups 先列出每個 API 主素材組（含該組下所有 versionIds），再列出未歸組版本的推測/比例 fallback 組，並標示 fallback。
- 勾選主素材組後一次建立多筆草稿：每勾一組即對應一筆草稿、selectedVersionIds 為該組全部版本；命名沿用既有範本（含 variant，variant 來自組名）。
- 快速變體「快速填入：選擇主素材組」：仍可用，選單來源改為 API 主素材組 + fallback 組。
- 刪除素材包時一併刪除其下主素材組；版本未強制隸屬組（groupId 選填）。

---

## 5. 哪些功能還沒完成

- **Meta 真發送**：未做。仍無一鍵送 Meta、無建立 Campaign/Ad Set/Ad。
- **campaign / ad set / ad 回寫**：未做。無回寫 campaignId、adSetId、adId、postId。
- **依廣告帳號過濾粉專 / IG**：未做。粉專/IG 仍為 token 下全列表，未依所選廣告帳號過濾。
- **素材工廠級**：未做。未自動判斷類型/比例、未自動抓影片時長/檔案大小/封面、未依主素材組/產品/是否已投放篩選、未做大量素材管理 UI。
- **命名範本自訂**：未做。使用者仍無法在 UI 自訂命名範本字串再存成範本。
- **批次建立失敗明細**：未做。若某筆 POST 失敗，前端未列出哪一筆、原因為何。
- **主素材組編輯/刪除 UI**：未做。僅能建立、列表顯示；無法在素材中心編輯組名或刪除組（後端有 PUT/DELETE，前端未接）。

---

## 6. 驗收標準

### 畫面驗收

- **素材中心**：選定一素材包後，右側應出現「主素材組」卡，可輸入名稱（如 A版）並點「建立主素材組」；建立後名稱以 Badge 顯示。下方「素材版本」區新增版本時，表單有「主素材組（選填）」下拉，可選剛建立的組；版本列表每張卡片可顯示所屬組名（若有）。
- **投放中心**：建立草稿、選定素材包後，「選素材版本」區下方「批次建組」應先列出該包的主素材組（來自 API，如 A版、B版），每組顯示含哪些比例、幾個版本、檔名；未歸組的版本會出現在 fallback 組並標「此組為 fallback 分組，建議手動確認」。勾選 3 個主素材組後，按鈕為「一次建立 3 筆草稿」。

### 操作驗收

- 素材中心：建立主素材組「A版」→ 新增版本並選主素材組「A版」→ 儲存 → 該版本應顯示在列表且標示 A版。
- 投放中心：選同一素材包 → 批次建組區應出現「A版」組；勾選 A版 → 點「一次建立 1 筆草稿」→ 應建立 1 筆草稿，其 selectedVersionIds 為 A 組內所有版本 id。若勾選 A版、B版、C版（3 組）→ 應建立 3 筆草稿。
- 若某版本未指定 groupId：該版本會出現在 fallback 區（依檔名或比例推測），仍可勾選並建立草稿；系統不阻擋。

### 資料驗收

- 建立主素材組後：`.data/asset-groups.json` 對應 userId 下應多一筆 { id, packageId, name, variantCode?, displayOrder?, createdAt }。
- 版本帶 groupId 儲存後：`asset-versions.json` 該筆 version 應有 `groupId`。
- 勾 3 個主素材組建立 3 筆草稿：drafts 應多 3 筆，每筆的 selectedVersionIds 分別為第 1、2、3 組的 versionIds，campaign/adSet/ad 名稱依範本含 variant（組名）。

### 邏輯驗收

- 一個素材包可包含多個主素材組（0～N）；一個主素材組底下掛多個版本（0～N），每個版本可有不同 aspectRatio。
- 勾 3 個主素材組 → 建立 3 筆草稿；每筆草稿的 selectedVersionIds = 該組內所有 versionIds。
- 若只上傳 9:16 一筆且歸到 A版：A 組僅 1 個版本，仍可建立 1 筆草稿；系統不阻擋單尺寸投放。
- 命名：沿用既有 applyNamingTemplate，variant 來自主素材組 name（或 fallback 組 label），預設範本為 `{product}_{variant}_{date}_{seq}`。
- 欄位沿用：主文案、標題、CTA、落地頁等沿用素材包；預算、受眾、帳號、命名範本等屬投放設定/範本。
- 粉專/IG/廣告帳號：仍為既有行為（可搜尋下拉、有 token 時列出），未做依帳號過濾。

---

## 7. Rollback 方式

- **還原檔案**：還原 `shared/schema.ts`、`server/modules/asset/asset-version.schema.ts`、`server/modules/asset/asset-version-service.ts`、`server/modules/asset/asset-package-service.ts`、`server/modules/asset/asset-package-routes.ts`、`client/src/pages/publish-placeholder.tsx`、`client/src/pages/assets.tsx`；刪除 `server/modules/asset/asset-group-repository.ts`、`server/modules/asset/asset-group-service.ts`。
- **新資料檔**：刪除 `.data/asset-groups.json`（若存在）。不刪不影響舊版程式，但舊版不認 AssetGroup。
- **既有資料**：`asset-versions.json` 若已有 `groupId` 欄位，還原後舊版 schema 不帶 groupId 時可能被忽略或需前端不讀；建議還原後若保留資料，確認 AssetVersion 型別是否仍含選填 groupId 或移除欄位。
- **無 DB migration**：僅 JSON 檔與 API 變更；還原後無 migration 要跑。

---

## 8. 風險與防呆

- **未歸組版本**：多數舊版本無 groupId，投放中心會以 fallback（檔名/versionNote/比例）分組，並標「此組為 fallback 分組，建議手動確認」；防呆為明確標示、不隱藏 fallback。
- **刪除主素材組**：後端有 DELETE，前端未做；若之後做刪除，需決定該組下版本是否清空 groupId（目前未實作，刪組後版本仍保留原 groupId，可能變成孤兒）。
- **批次建立**：仍為前端多次 POST，組數多時可能較慢；防呆為按鈕 disabled 期間顯示 loading，成功後 toast 顯示建立筆數。
- **命名重名**：若多組同名或 variant 未區分，可能產生重複 campaign 名稱；防呆為依 seq 與 date 區分，建議之後補範本自訂與唯一性檢查。
- **粉專/IG 未依帳號過濾**：可能選到與當前廣告帳號無關的粉專/IG；防呆為目前僅列出 token 下清單，未聲稱綁定關係正確。

---

## 9. 自我檢討 5 題

1. **這一輪離「真正比 Meta 後台快」還差哪 5 件事？**  
   (1) 一鍵送 Meta 與回寫 ID；(2) 帳號/粉專/IG 綁定與依帳號過濾；(3) 命名範本自訂與批次失敗明細；(4) 素材工廠級自動判斷與篩選；(5) 分析閉環（投放結果回寫與報表）。

2. **這一輪最像「先求可用，不是最佳解」的是哪些地方？**  
   主素材組在素材中心僅能「建立」與顯示，無法編輯/刪除；未歸組版本仍靠檔名推測與比例 fallback，推測規則固定；批次建組仍前端迴圈 POST，無單一「批次 API」。

3. **如果一天 80 支素材、7 天 500+，最先爆掉的是哪裡？**  
   素材中心版本列表仍為虛擬捲動單頁，篩選僅日期/類型/比例/關鍵字，無主素材組篩選、無分頁；`.data` JSON 單檔會變大，讀寫與查詢會變慢；投放中心若一次勾很多組，多次 POST 延遲與失敗率會上升。

4. **哪些地方現在看似完成，其實還只是半成品？**  
   主素材組「有 CRUD 後端、建立與顯示」但缺編輯/刪除 UI；批次建組「有主素材組優先」但 fallback 仍依檔名規則與比例；命名「有 variant」但範本字串仍無法使用者自訂儲存。

5. **如果下一輪做錯，最可能錯在哪個理解層？**  
   把「主素材組」當成只存在投放端、不當成素材包底下正式一層，又回到「只依比例或檔名」分組；或先做一鍵送 Meta 而沒先把「一筆草稿對應一主素材組」與回寫 ID 的資料結構講清楚，導致後續要大改。

---

## 10. 有沒有偏離需求

- **沒有。**  
- 需求為：素材包底下要有主素材組（A版/B版/C版），每個主素材組底下掛 9:16/4:5/1:1 版本；投放中心改為先選主素材組、勾選後批次建草稿。本輪已做：AssetGroup 實體、版本 groupId、素材中心建立主素材組與版本歸組、投放中心以 API 主素材組優先並保留 fallback，未動左側主架構與分析區，未做大型表單，未以比例為唯一分組依據。

---

## 11. 下一階段建議做什麼

- **建議**：依你排程先做「素材中心改成真正素材工廠」（自動判斷類型/比例、時長/大小/封面、依日期/主素材組/產品/是否已投放篩選、大量管理），再做「投放中心改成批次建組器」的體驗收斂（預設先選主素材組、命名系統化），再補帳號/粉專/IG 綁定與過濾，最後做一鍵送 Meta + 回寫。  
- **理由**：主素材組已成一層，素材端若能有主素材組篩選與自動判斷，投放端以組為單位會更穩；綁定與一鍵送出依賴前兩步的資料與流程穩定。  
- **依賴**：依賴本輪的 AssetGroup、groupId、以及投放中心「主素材組優先」的 batchGroups 與建立邏輯。  
- **本輪已停在這裡，未繼續實作下一階段。**

---

## A. 這一輪到底哪裡開始真正贏過 Meta 後台

- **原本在 Meta**：要產出多組廣告（例如同產品、A/B/C 三支創意各多尺寸），通常要複製廣告 → 改名稱 → 換素材（常需手動選多個檔案對應同一創意）→ 再複製再改再換，容易對錯組、名稱不一致。  
- **現在在系統**：在素材中心先建立主素材組（A版、B版、C版），上傳或編輯版本時指定所屬組；到投放中心選素材包後，直接勾選「A版」「B版」「C版」，一次建立 3 筆草稿，每筆自動帶入該組全部版本、名稱依範本含組名。**少掉**手動複製、手動對「哪幾個檔案是同一創意」、手動改名稱的步數；**減少**送錯組的風險。

---

## B. 本輪建立結果明細

- **系統建議分幾組**：依「該素材包下主素材組（API）」+「未歸組版本的推測/比例 fallback」產出。例如 3 個主素材組（A版、B版、C版）+ 2 個未歸組版本（推測為一組或兩組）→ 建議 4 或 5 組。  
- **使用者勾幾組**：由使用者在批次建組區勾選；例如勾 A版、B版、C版 → 3 組。  
- **最後建立幾筆草稿**：與勾選組數相同；每組一筆，每筆的 selectedVersionIds = 該組內所有 versionIds。  
- **每筆草稿對應哪些 selectedVersionIds**：第 k 筆對應第 k 個勾選組的 versionIds 陣列（該主素材組下所有版本的 id）。  
- **命名怎麼產生**：`applyNamingTemplate(template, { product, date, ratio, seq, prefix, variant })`；variant = 主素材組的 name（或 fallback 組的 label），預設範本 `{product}_{variant}_{date}_{seq}`；product 來自素材包，date 為當日 YYYYMMDD，seq 為 1,2,3…。

---

## 交付問答（你要求的 8 點）

1. **一個素材包可包含幾個主素材組？**  
   0～N 個；無上限，依使用者建立數量。

2. **一個主素材組怎麼掛多尺寸版本？**  
   版本有 `groupId` 指向該組；同一 groupId 的多筆 AssetVersion 即為該組下的多尺寸（9:16、4:5、1:1 等），在素材中心新增/編輯版本時選「主素材組」即可歸組。

3. **勾 3 個主素材組後，最後會建立出幾筆草稿？**  
   3 筆。

4. **每筆草稿的 selectedVersionIds 是哪些？**  
   第 1 筆 = 第 1 個勾選組內所有 versionIds；第 2 筆 = 第 2 個勾選組內所有 versionIds；第 3 筆 = 第 3 個勾選組內所有 versionIds。

5. **名稱怎麼自動生成？**  
   依範本（預設 `{product}_{variant}_{date}_{seq}`）替換 product、variant（主素材組名）、date、seq、prefix；系統先自動命名，人可改。

6. **哪些欄位沿用素材包，哪些屬於投放模板？**  
   沿用素材包：主文案、標題、CTA、落地頁、備註（未覆寫時）。屬投放設定/範本：廣告帳號、粉專、IG、預算、受眾、Placement、命名範本（campaignNameTemplate、adSetNameTemplate、adNameTemplate）等。

7. **若只上傳 9:16，是否仍可投放；系統如何提示但不阻擋？**  
   可以。若該版本歸到某主素材組，勾選該組即建立一筆草稿（selectedVersionIds 僅一筆）；若未歸組，會落在 fallback 組，仍可勾選建立。系統不阻擋單尺寸；若之後要提示「建議多尺寸」，可另做提示文案，不擋建立。

8. **粉專 / IG / 廣告帳號如何綁定與過濾？**  
   本輪未實作綁定與過濾。目前為：廣告帳號來自同步帳號列表、粉專/IG 來自 Meta token `me/accounts`，皆為可搜尋下拉；未依所選廣告帳號過濾粉專/IG，未做「某帳號對應某粉專」的綁定表。
