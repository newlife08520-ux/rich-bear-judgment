# Phase A + Phase B 實作計畫（第一輪）

本文件為**第一輪**實作範圍：**Phase A（上傳正式化）** 與 **Phase B（素材中心流程重整）**。  
不涉及投放中心、投放紀錄、模板、批次建組、命名解析、Meta 發佈。  
左側主架構與分析區**完全不改**。

---

## Phase A 補強說明（舊檔讀取 + NAS fail-fast）

### 方案選擇：**方案 A**

- **原因**：每筆版本自己帶 `storageProvider`，讀檔時依該筆記錄決定用 local 或 NAS provider，不依「目前系統用哪個」。  
- 不改 fileUrl 格式，既有資料與前端無須改 URL；舊資料無 `storageProvider` 時視為 local，相容現有 .data/uploads 的檔案。  
- 之後若要擴充 storagePath / storageKey 也可在 AssetVersion 上加欄位，不影響現有邏輯。

### 補強會改的檔案

| 檔案 | 變更 |
|------|------|
| `shared/schema.ts` | AssetVersion 新增 `storageProvider?: "local" | "nas"`、型別 `StorageProvider`。 |
| `server/modules/asset/upload-provider-types.ts` | SaveFileResult 新增必填 `storageProvider`。 |
| `server/modules/asset/upload-provider-local.ts` | saveFile 回傳 `storageProvider: "local"`。 |
| `server/modules/asset/upload-provider-nas.ts` | saveFile 回傳 `storageProvider: "nas"`；新增 `checkNasConfig()`，createNasUploadProvider 開頭呼叫。 |
| `server/modules/asset/upload-provider.ts` | 新增 `getProviderByKey(key)`、`resolveFilePathForRequest(userId, filename)`（依版本查 storageProvider 再取路徑）、`ensureUploadProviderReady()`。 |
| `server/modules/asset/upload-storage.ts` | SaveResult 與回傳值新增 `storageProvider`。 |
| `server/modules/asset/asset-version-repository.ts` | 新增 `getByUserIdAndFileUrl(userId, fileUrl)`。 |
| `server/modules/asset/asset-version.schema.ts` | create  schema 新增 `storageProvider` 選填。 |
| `server/modules/asset/asset-version-service.ts` | create 時寫入 `storageProvider`。 |
| `server/routes.ts` | GET /api/uploads 改用 `resolveFilePathForRequest`；`registerRoutes` 開頭呼叫 `ensureUploadProviderReady()`。 |
| `client/src/pages/assets.tsx` | 版本表單與上傳回應帶入 `storageProvider`，建立/更新版本時一併送出。 |

### 既有 fileUrl / 既有資料

- **fileUrl 不變**：仍為 `/api/uploads/{userId}/{filename}`。  
- **既有資料**：已存在的 AssetVersion 沒有 `storageProvider`；讀檔時 `resolveFilePathForRequest` 查無版本或未設則用 **local**，故舊檔仍從 .data/uploads 讀取。  
- **新上傳**：上傳回應與建立版本會帶入 `storageProvider`，之後讀檔依該欄位選 provider。

### 補強 rollback

- 還原上述檔案；若保留 schema 的 `storageProvider` 欄位不刪，僅停用「依 storageProvider 讀檔」邏輯（routes 改回用 `getFilePath(userId, filename)` 且只用目前 provider），則舊 local 檔仍可用，但 NAS 時期建立的檔在切回 local 後會 404。  
- 完整 rollback：一併還原 schema、provider、routes、client 表單與 API 回傳，並還原 Phase A 補強前狀態。

### 補強後 acceptance（見下方第六節）

- 已於「Phase A 驗收」中新增步驟 4（混合模式）、步驟 5（NAS fail-fast）。

---

## 一、會改哪些檔案

### Phase A：上傳正式化

| 檔案 | 改動性質 |
|------|----------|
| **新增** `server/modules/asset/upload-provider-types.ts` | 定義 `IUploadProvider`、`SaveFileInput`、`SaveFileResult`。 |
| **新增** `server/modules/asset/upload-provider-local.ts` | Local 實作：將現有 `upload-storage.ts` 的邏輯搬入，實作 `saveFile` / `getFilePath` / `getPublicUrl`。 |
| **新增** `server/modules/asset/upload-provider-nas.ts` | NAS 實作：依 NAS 路徑結構寫檔；`getFilePath` 回傳 NAS mount 路徑；`getPublicUrl` 可回傳相對或 NAS 對外 URL。 |
| **新增** `server/modules/asset/upload-provider.ts` | 依 `UPLOAD_PROVIDER` 環境變數匯出 `local` 或 `nas` 的 provider 實例。 |
| **修改** `server/modules/asset/upload-storage.ts` | 改為**委派**給上述 provider（或標記 deprecated 並讓 routes 直接使用 provider）；保留 `ensureUserUploadDir` 若 local 仍需。 |
| **修改** `server/modules/asset/asset-package-routes.ts` | `POST .../versions/upload` 改為呼叫 `uploadProvider.saveFile(...)`，不再直接呼叫現有 `uploadStorage.saveFile`。 |
| **修改** `server/routes.ts` | `GET /api/uploads/:userId/:filename` 改為使用 `uploadProvider.getFilePath(userId, filename)`，再 `res.sendFile`；無檔案則 404。 |

**環境變數（Phase A）**：  
- `UPLOAD_PROVIDER`：`local`（預設）或 `nas`。  
- NAS 時：`NAS_BASE_PATH`（寫入根目錄）、可選 `NAS_PUBLIC_BASE_URL`（對外 URL 前綴）。

---

### Phase B：素材中心流程重整

| 檔案 | 改動性質 |
|------|----------|
| **修改** `server/modules/asset/asset-package.schema.ts` | 建立時：`brandProductName` 改為選填或預設空字串；`adObjective`、`status` 設預設值；`primaryCopy`、`headline`、`cta`、`landingPageUrl` 維持可空/預設空，不強制 min(1)。使「只填名稱 + 產品名稱（可後補）」即可建立。 |
| **修改** `client/src/pages/assets.tsx` | ① 素材包表單：順序改為「名稱 → 產品名稱 → 素材版本區（上傳/新增版本）→ 預設文案區（摺疊或次要）」；② 廣告目的、狀態移入「進階」或表單下方次要區，不擋建立；③ UI 標籤「品牌/產品」改為「產品名稱」；④ 建立素材包時，至少必填「名稱」，產品名稱與文案可後補（與後端 schema 放寬一致）。 |

**不改的後端**：  
- `asset-package-repository.ts`、`asset-version-repository.ts`、`asset-version-service.ts`、`asset-package-service.ts` 的**介面與資料結構**不變；僅 service 若因 schema 放寬而傳入預設值，不影響既有已存在資料。  
- `shared/schema.ts` 的 `AssetPackage` 型別：若後端 schema 已允許空字串，可不必改型別；若需明確「選填」，可僅在 Zod 放寬，TypeScript 型別可維持 `string`（空字串仍為 string）。

---

## 二、不會改哪些檔案

以下**完全不修改**（硬限制）：

- **路由與頁面**：`App.tsx`、`client/src/components/app-sidebar.tsx`（左側主架構與導覽）。
- **戰情 / 分析 / 判讀 / 紀錄 / 設定**：  
  `client/src/pages/dashboard.tsx`、`fb-ads.tsx`、`ga4-analysis.tsx`、`judgment.tsx`、`history.tsx`、`settings.tsx`、`login.tsx`、`not-found.tsx`。
- **投放相關（本輪不碰）**：`client/src/pages/publish-placeholder.tsx`、`publish-history-placeholder.tsx`；`server/modules/publish/*` 全部。
- **共用**：`client/src/lib/*`、`client/src/hooks/*`（除未來若為素材專用則例外）、`shared/schema.ts` 的**非** AssetPackage/AssetVersion 部分。
- **後端主入口與其他模組**：`server/index.ts`、`server/storage.ts`、與 FB/GA4/判讀/設定相關的 routes 與 services。
- **drizzle / migrations**：本輪仍使用 JSON 儲存素材/投放，不變更 DB schema 或 migration。

---

## 三、哪些既有行為保證不變

1. **左側導覽**：項目、順序、權限、連結不變。  
2. **戰情總覽 / FB 帳號分析 / GA 頁面分析 / 內容判讀 / 判讀紀錄 / 設定中心**：無任何程式碼或資料流改動。  
3. **投放中心與投放紀錄**：本輪不修改；行為與現有一致。  
4. **素材中心對外 API**：  
   - `GET/POST/PUT/DELETE /api/asset-packages`、`GET/POST/PUT/DELETE /api/asset-packages/:id/versions`、`POST /api/asset-packages/:id/versions/upload` 路徑與**回應格式**不變。  
   - 上傳成功後仍回傳 `{ fileUrl, fileName, fileType }`；建立版本仍接受相同 body；建立素材包時僅放寬必填，既有欄位仍可送。  
5. **已存在資料**：既有 `.data/asset-packages.json`、`asset-versions.json`、`.data/uploads/` 的資料與檔案；讀寫方式不變（local provider 仍寫 `.data/uploads`），NAS 僅在 `UPLOAD_PROVIDER=nas` 時啟用。  
6. **登入與權限**：`requireAuth`、session、userId 隔離不變。

---

## 四、風險點

| 風險 | 說明 | 緩解 |
|------|------|------|
| **A：切換 provider 後路徑不一致** | 從 local 改 NAS 後，既有 DB 內的 `fileUrl` 可能指向 `/api/uploads/...`，NAS 新檔可能是另一種 URL，導致舊圖無法顯示。 | 本輪 NAS 的 `getPublicUrl` 可與 local 一樣回傳相對路徑，由同一 `GET /api/uploads/:userId/:filename` 經 provider 的 `getFilePath` 讀取（NAS 時讀 NAS mount 路徑）；或 NAS 新檔仍寫入可被同一 GET 服務的路徑，避免雙軌 URL。 |
| **A：NAS 未掛載或權限錯誤** | 正式環境設為 NAS 但 mount 失敗，上傳會報錯。 | 啟動時可選做「provider 健康檢查」；文件註明 NAS 需先掛好且 `NAS_BASE_PATH` 可寫。 |
| **B：後端放寬必填導致舊客戶端送空** | 若其他地方曾依賴「品牌/產品必填」做顯示，放寬後可能出現空字串。 | 前端列表與表單仍顯示「產品名稱」，空則顯示「—」或「未填」；不影響既有已填資料。 |
| **B：廣告目的/狀態改次要後預設值** | 建立時若不選，需有預設（如 `adObjective: "sales"`、`status: "draft"`），否則後端或列表可能報錯。 | schema 明確 `.default("sales")`、`.default("draft")`；列表 Badge 仍可顯示狀態。 |
| **改動 upload-storage 的呼叫點** | 若遺漏某處仍直接呼叫舊 `saveFile`，會行為不一致。 | 僅 `asset-package-routes.ts` 與（若存在）其他上傳入口改為呼叫 provider；grep 確認無殘留。 |

---

## 五、Rollback 方案

### Phase A

- **程式**：還原 `asset-package-routes.ts`、`routes.ts` 對 provider 的改用，改回直接呼叫原 `upload-storage.saveFile` / `getFilePath`；刪除或保留不啟用的 `upload-provider-*.ts`、`upload-provider.ts`。  
- **環境**：將 `UPLOAD_PROVIDER` 設回 `local`（或移除變數）。  
- **資料**：本輪未遷移既有檔案；新上傳的若在 NAS，rollback 後該 URL 可能 404，但 DB 內仍為新檔，可事後再處理或僅還原程式、不還原 NAS 上的檔。

### Phase B

- **程式**：還原 `asset-package.schema.ts` 的必填與預設；還原 `assets.tsx` 表單順序、廣告目的/狀態位置、標籤。  
- **資料**：未改 repository 格式；已建立的「僅名稱、產品名為空」的素材包仍存在，若 rollback schema 為必填，之後「更新」時需補填才能通過驗證，建立新包則恢復舊必填行為。

### 建議

- 每階段合併前打 tag（如 `phase-a-upload-provider`、`phase-b-assets-flow`），rollback 時可依 tag 還原。

---

## 六、Acceptance / 驗收步驟

### Phase A 驗收（含補強後）

1. **Local（預設）**  
   - 未設或 `UPLOAD_PROVIDER=local` 啟動服務。  
   - 素材中心：選一素材包 → 上傳一圖片/影片 → 建立版本。  
   - 列表與編輯頁可顯示該版本；圖片/影片可正常顯示（`GET /api/uploads/:userId/:filename` 回傳 200）。  
   - 確認檔案實體在 `.data/uploads/{userId}/` 下。

2. **NAS**  
   - 設定 `UPLOAD_PROVIDER=nas`、`NAS_BASE_PATH=/path/to/mount/...`（或實際 NAS mount 路徑）。  
   - 上傳一檔 → 建立版本。  
   - 確認檔案出現在 NAS 預期目錄（例如 `{NAS_BASE_PATH}/{userId}/...` 或依你規劃之子路徑）。  
   - `GET /api/uploads/:userId/:filename` 回傳 200 且內容正確（由 provider.getFilePath 取得 NAS 路徑後 sendFile）。

3. **不影響其他功能**  
   - 戰情、FB 分析、GA 分析、內容判讀、判讀紀錄、設定、投放中心、投放紀錄：操作一輪無報錯、無 404。

4. **混合模式（補強後必驗）**  
   - 一筆在 **local** 模式建立：`UPLOAD_PROVIDER=local`（或不設），上傳一檔並建立版本 A。  
   - 改為 **NAS**：設 `UPLOAD_PROVIDER=nas`、`NAS_BASE_PATH=...`，重啟，上傳另一檔並建立版本 B。  
   - 兩筆在素材中心列表與詳情皆可正常顯示，圖片/影片可載入。  
   - 再改回 **local** 重啟，版本 A 與版本 B 仍皆可正常顯示與讀取（讀檔依每筆版本的 `storageProvider` 決定用哪個 provider，不依目前系統設定）。  

5. **NAS fail-fast**  
   - 設 `UPLOAD_PROVIDER=nas` 但 `NAS_BASE_PATH` 不存在或不可寫，啟動時應拋錯、服務不啟動。  

### Phase B 驗收

1. **建立素材包：最少必填**  
   - 只填「素材包名稱」、產品名稱可留空（若 schema 允許）或填一筆；不填主文案、標題、CTA、網址；廣告目的/狀態在進階或預設。  
   - 送出後成功建立；列表出現該包。

2. **先上傳、再補文案**  
   - 進入該包 → 先新增版本（上傳或貼 URL）→ 儲存版本。  
   - 再編輯素材包，補預設文案、標題、CTA、網址 → 儲存。  
   - 流程無被「必填文案」擋住。

3. **廣告目的 / 狀態不擋主流程**  
   - 建立或編輯時，廣告目的與狀態不在最上方、或收在「進階」；預設為「銷售」（或你指定）、「草稿」。  
   - 不選也能儲存。

4. **產品名稱**  
   - UI 標籤為「產品名稱」（非「品牌/產品」）；列表與表單顯示一致。

5. **既有行為**  
   - 已有素材包（含品牌/產品、廣告目的、狀態、文案）仍可正常編輯、顯示、刪除；投放中心選該包仍正常帶入文案。

---

## 七、最可能做歪的 5 件事（自我檢討）

1. **把 Phase A 做成大改動**  
   - 例如重寫整個上傳流程、改 multer 或改 API 路徑。  
   - **避免**：只抽 provider、route 只改「呼叫誰」；API 路徑與 request/response 格式不變。

2. **NAS 路徑與 local 行為不一致**  
   - 例如 NAS 回傳的 `fileUrl` 變成絕對外網 URL，導致 local 與 NAS 混用時部分圖無法顯示。  
   - **避免**：本輪 NAS 也讓「讀檔」走同一支 `GET /api/uploads/...`，由 provider 回傳實體路徑；`fileUrl` 仍可存相對路徑，僅文件註明未來若要做 CDN 再改 `getPublicUrl`。

3. **Phase B 又塞滿表單**  
   - 例如「進階」裡仍把廣告目的/狀態放在很顯眼、或文案區仍佔一大塊。  
   - **避免**：主區塊只有「名稱 + 產品名稱 + 版本區」；文案區摺疊或明顯標「可後補」；廣告目的/狀態一組放在最下或收合。

4. **放寬 schema 時改壞 update**  
   - 例如 `assetPackageUpdateSchema` 改為 `.partial()` 後，某欄位變成 optional 導致型別或後端邏輯錯誤。  
   - **避免**：只放寬 create 的 default 與 min；update 維持 partial，不刪欄位；跑一輪「建立 + 更新」的整合確認。

5. **動到不該動的檔案**  
   - 例如為「統一風格」去改 sidebar 或 dashboard。  
   - **避免**：本輪改動清單僅限「會改哪些檔案」；其餘一律不開、不重構。

---

## 八、執行方式（本輪遵守）

- 一次只做一小段（例如先 Phase A 的 types + local provider + 改 route，驗收通過再做 NAS provider）。  
- 每段完成附當段 acceptance 與 rollback 說明。  
- 不擴需求（不做模板、批次建組、命名解析、Meta 發佈）。  
- 若發現任何改動可能影響戰情/FB/GA/判讀/紀錄/設定或左側架構，先停並說明。  
- 若與原方案文件有偏差（例如 NAS 實際 mount 方式不同），以本計畫與實際環境為準，主動修正不硬做。

---

以上為 Phase A + Phase B 的實作計畫，待你確認範圍與風險後再進入實作。
