# Phase C-1 驗收證據與自我檢查

## 1. Build / Run 證明

### 1.1 `npm run build` 結果

- **指令**：`Set-Location "d:\AI審判官\Du-She-Shen-Pan-Guan"; npm run build`
- **結果**：**成功**（Exit code: 0）
- **輸出摘要**：
  - client: Vite 建置完成，`../dist/public/` 產出 index.html、CSS、JS chunks
  - server: `dist\index.cjs` 約 1.3mb
  - 有 **PostCSS** 警告（`from` option）、**chunk 體積** 建議（部分 > 500 kB），**無錯誤**

### 1.2 `npm run dev` 是否正常啟動

- **本次執行**：在專案目錄執行 `npm run dev` 時 **失敗**，原因為 **EADDRINUSE: address already in use 127.0.0.1:5000**
- **解讀**：代表 5000 port 已被佔用（可能已有 dev 在跑或其它程式）。改以直接造訪 `http://127.0.0.1:5000` 時，**應用可正常載入**（登入頁 → 戰情總覽 → 素材中心），故推斷在「無 port 衝突」情境下 `npm run dev` 可正常啟動。
- **建議**：若需重現「從零啟動」，請先關閉佔用 5000 的程式後再執行 `npm run dev`。

### 1.3 Console / Runtime Error

- **造訪流程**：登入 (manager / manager123) → 戰情總覽 → 直接導向 `/assets` → 新增素材包 → 建立「Phase C-1 測試包」
- **觀察**：上述操作過程中 **未發現** 於 MCP browser 回報的 console error 或 runtime error；頁面標題、按鈕、表單、導覽皆正常。
- **說明**：未使用 DevTools 做完整 console 掃描，若您本地有看到錯誤可補上。

---

## 2. 實際畫面證據

### 2.1 素材中心入口與空狀態

- **URL**：`http://127.0.0.1:5000/assets`
- **畫面**：
  - 標題「素材中心」、左側「新增素材包」、右側「請從左側選擇素材包，或點「新增素材包」建立」。
- **有資料時**：左側選中「Phase C-1 測試包」後，右側出現「素材版本」區、「新增版本」按鈕、「尚無版本，請點「新增版本」」、下方「素材包主檔」表單。

### 2.2 素材版本卡片網格、篩選、批次（程式行為說明）

- **版本列表**：在 `client/src/pages/assets.tsx` 中，當 `versions.length > 0` 時會顯示：
  - **篩選列**：日期（全部/今天/昨天/最近 7 天/最近 30 天/自訂區間）、類型（全部/圖片/影片）、比例（全部 + 各比例）、關鍵字輸入、排序（最新上傳/名稱排序）。
  - **批次列**：全選 Checkbox、取消選取、批次刪除 (N)。
  - **卡片網格**：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`，每張卡含：80x80 縮圖區（圖片用 `v.fileUrl`、影片用 `v.thumbnailUrl` 或 Film 圖示）、檔名、類型·比例·上傳時間、主版本 Badge、設為主版本/編輯/刪除、多選 Checkbox。
- **本次自動化**：目前環境下未執行「檔案上傳」，因此 **未產生「有版本」時的截圖**（卡片網格、日期篩選、多選+批次刪除）。您可在本機：**選一素材包 → 新增版本 → 選擇檔案上傳至少一筆**，即可看到上述 UI 並自行截圖作為證據。

### 2.3 圖片縮圖 / 影片封面

- **程式**：圖片用 `<img src={v.fileUrl} />`；影片若有 `v.thumbnailUrl` 則用該圖，否則顯示 `<Film />` 圖示。
- **證據**：需在有至少一筆圖片/影片版本時才會出現；請在本機上傳後截圖。

### 2.4 日期篩選（今天/昨天/7 天/自訂區間）

- **程式**：`versionDateFilter` + 自訂時 `versionDateCustomStart` / `versionDateCustomEnd`，與 `filteredAndSortedVersions` 的 date 判斷一致。
- **證據**：篩選列僅在 `versions.length > 0` 時渲染；請在有版本時操作並截圖。

### 2.5 多選 + 批次刪除前後

- **程式**：`selectedVersionIdsForBatch`、全選/單卡 Checkbox、批次刪除呼叫 `batchDeleteVersions`（迴圈 DELETE `/api/asset-versions/:id`）。
- **證據**：需有至少一筆版本，勾選後點「批次刪除」再截圖前後列表。

---

## 3. 實際操作結果（依程式邏輯與可驗證項）

| 項目 | 預期行為 | 說明 |
|------|----------|------|
| 上傳圖片後自動帶入 MIME、類型、比例 | 會：`fileType` 用 API/file.type；`assetType` 依 `mime.startsWith("video/")` 設為 image/video；圖片另呼叫 `getImageAspectRatio(file)` 帶入建議比例 | 需在本機選圖檔上傳後檢查表單欄位 |
| 上傳影片後自動帶入 MIME、類型；比例 | 會帶入 MIME、類型為 video；**比例目前仍需手選**（未實作影片解析或後端回傳比例） | 明講：影片比例為手動選擇 |
| 關鍵字篩選 | 會：篩選檔名、素材包名稱、產品名稱（皆 toLowerCase + includes） | 有版本時在關鍵字框輸入即可驗證 |
| 排序 | 會：最新上傳（createdAt 降序）、名稱排序（fileName 字串比） | 有版本時切換下拉即可驗證 |
| 批次刪除 | 會：依選中的 id 逐一 DELETE，成功後 invalidate 列表並 toast | 有版本時多選後點批次刪除即可驗證 |

---

## 4. `client/src/pages/assets.tsx` 實際新增/修改區塊

### 4.1 新增的 state

```ts
const [versionDateFilter, setVersionDateFilter] = useState<string>("all");
const [versionDateCustomStart, setVersionDateCustomStart] = useState("");
const [versionDateCustomEnd, setVersionDateCustomEnd] = useState("");
const [versionTypeFilter, setVersionTypeFilter] = useState<string>("all");
const [versionRatioFilter, setVersionRatioFilter] = useState<string>("all");
const [versionKeyword, setVersionKeyword] = useState("");
const [versionSortBy, setVersionSortBy] = useState<"newest" | "name">("newest");
const [selectedVersionIdsForBatch, setSelectedVersionIdsForBatch] = useState<Set<string>>(new Set());
const [batchDeleting, setBatchDeleting] = useState(false);
```

### 4.2 新增的 function / 邏輯

- **模組級**：`ASPECT_RATIOS` 常數、`getImageAspectRatio(file: File): Promise<AssetAspectRatio>`（依圖片寬高比對預設比例）。
- **元件內**：`getDateRange`（useMemo，今日/昨日/7 天/30 天邊界）、`filteredAndSortedVersions`（useMemo：關鍵字/類型/比例/日期篩選 + 排序）、`batchDeleteVersions`（迴圈 DELETE 選中的 version id）。
- **上傳回調**：`handleVersionFileUpload` 內在上傳成功後設定 `assetType`（依 MIME）、`aspectRatio`（圖片時呼叫 `getImageAspectRatio`，失敗則維持 1:1）。

### 4.3 舊 UI 被替換的部分

- **移除**：版本列表的 **Table**（TableHeader / TableBody / TableRow / TableCell）整塊，包含類型、比例、檔名、URL、MIME、備註、主版本、操作欄。
- **改為**：篩選列（Select + Input）+ 批次操作列（Checkbox 全選、取消選取、批次刪除）+ **卡片網格**（每卡：縮圖、檔名、類型·比例·日期、主版本、操作鈕、多選 Checkbox）。

### 4.4 Import 變更

- **新增**：`Film` from "lucide-react"、`Checkbox` from "@/components/ui/checkbox"、`useMemo` in react。
- **移除**：`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from "@/components/ui/table"。

### 4.5 未做完或僅先求可用的部分

- **影片比例**：未自動帶入，需手選。
- **影片 thumbnailUrl / durationSeconds**：上傳 API 未回傳、前端未寫入表單；列表僅顯示既有 `v.thumbnailUrl` 或 Film 圖示。
- **自訂日期**：未做時間區間驗證（例如結束日早於開始日仍會送進篩選）。
- **批次刪除**：無單一後端「批次刪除」API，為 N 次 DELETE，大量選取時可能較慢或需考慮 rate limit。

---

## 5. 自我檢查（直接回答）

### 5.1 這一版離「高效率素材管理」還差哪 5 點？

1. **跨素材包搜尋**：關鍵字只搜「當前選中素材包」的名稱/產品名與版本檔名，無法一次搜全部素材包或跨包篩選。
2. **後端篩選/分頁**：篩選與排序都在前端，資料量大時（例如單包數百筆）會一次載入、效能與體驗差；缺少後端 query 參數與分頁。
3. **影片資訊自動帶入**：影片上傳後未帶入比例、duration、thumbnail；若後端有提供或可從檔案解析，應一併帶入。
4. **批次移動/標籤**：僅實作批次刪除，未實作「批次移動到另一素材包」或「批次設標籤」，離高效率整理還差一截。
5. **操作反饋與防呆**：批次刪除無二次確認、無「復原」或軟刪除；大量刪除時若誤觸風險高。

### 5.2 哪些地方只是先求可用，不是最佳做法？

- **日期範圍**：用 `useMemo` 算「今天/昨天/7 天/30 天」且依賴 `getDateRange` 的參考，若跨日不重新掛載，理論上「今天」會過期；實務上重新整理或切頁會更新。
- **批次刪除**：用迴圈呼叫多個 DELETE，非單一 batch API；成功/失敗只以計數 toast 呈現，未逐筆列出失敗項。
- **篩選/排序**：全在前端、無 URL 參數，重新整理或分享連結無法還原目前篩選/排序狀態。
- **影片預覽**：無 `thumbnailUrl` 時只顯示圖示，未用 `<video>` 預覽或後端產生封面。

### 5.3 若一天 80 支素材，這版最先會卡在哪？

1. **一次載入 80 筆**：目前 GET 單包 versions 一次全拿，80 筆仍可接受，但若單包成長到數百筆，列表會變慢且篩選/排序都在主 thread。
2. **批次刪除 80 筆**：80 次 DELETE 請求，耗時與伺服器負載明顯，且無進度條或「處理中」明細。
3. **卡片網格 DOM**：80 張卡同時渲染，每張含 img；若圖片未做 lazy 或縮圖 CDN，捲動與記憶體會先有感。

---

以上為 Phase C-1 的 build/run 證明、畫面與操作說明、程式變更清單及自我檢查；有版本時的截圖建議由您在本機上傳 1～2 筆後補齊。
