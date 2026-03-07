# 本輪完成回報：ffprobe 安裝與 success 實證

---

## 1. 哪些完成

- **在可控制環境安裝 ffprobe / ffmpeg**
  - **安裝方式**：Windows 使用 `winget install -e --id BtbN.FFmpeg.GPL --accept-source-agreements --accept-package-agreements`，已實跑成功。
  - **安裝後驗證 PATH**：以「重載 PATH 後執行 `ffprobe -version`」驗證，實跑輸出 ffprobe version 與 libav* 版本資訊（exit 0）。
  - 以上已寫入 **docs/ffprobe-安裝與驗證.md**，含實跑結果，非僅理論步驟。
- **ffprobe health check 實跑**
  - **執行**：`node scripts/run-ffprobe-check.mjs`（執行前已重載 PATH）。
  - **回報**：**HTTP status 200**；**response body** `{ "ok": true, "message": "ffprobe 可執行" }`；**已從 503 ENOENT 變成 200 ok: true**。
- **1 筆真實 success 證據（detectMedia 端）**
  - **影片**：下載之 sample 影片（scripts/sample-video.mp4，來源 w3schools mov_bbb.mp4）。
  - **執行**：`npx tsx scripts/verify-video-detection.ts scripts/sample-video.mp4`。
  - **回報**：
    - **detectStatus**：success  
    - **detectSource**：metadata  
    - **aspectRatio**：16:9  
    - **detectedWidth**：320，**detectedHeight**：176，**detectedDurationSeconds**：10  
    - detectSource 為 **metadata**；腳本輸出「結果: success（metadata 偵測成功）」。
  - **UI 與完整鏈路**：同一支影片（或任一支真實影片）在應用內「上傳 → 建立版本」後，應寫入上述 metadata、detectStatus: success、detectSource: metadata；素材中心與投放中心版本卡應顯示 Badge「真偵測」。本輪已取得**腳本端 success 實測**；**應用內上傳→寫入→UI** 需在瀏覽器操作一次並依下方證據表留存截圖／紀錄。
- **success 證據截圖／紀錄補齊**
  - **health check 成功**：已留存實跑輸出（200 + ok: true），見上文與 docs/ffprobe-安裝與驗證.md。
  - **該支影片偵測結果**：已留存腳本輸出（success / metadata / 16:9 / 320x176 / 10s）。
  - **UI Badge / metadata 欄位**：需在應用內上傳該影片（或 sample-video.mp4）並建立版本後，於素材中心與投放中心截圖「真偵測」Badge 與版本詳情（若有 metadata 欄位一併留存）；本輪已提供操作步驟與證據表欄位。
- **最終判定**
  - **已閉環**：**影片偵測鏈路（ffprobe 可用 → detectMedia → success / metadata / aspectRatio）** 在當前環境已閉環；安裝、health check、真實影片 success 皆已實跑並有紀錄。
  - **未閉環／待補**：**「上傳 → 寫入 DB → UI 顯示」** 端到端需在應用內上傳同一支（或任一支）影片、建立版本後，確認 API 與 UI 顯示「真偵測」與 metadata，並留存截圖後，整條「上傳→偵測→寫入→UI」方可宣稱完全閉環。

---

## 2. 哪些沒完成

- **應用內上傳該影片後之 API 回應與 UI 截圖**：需在瀏覽器登入、上傳 scripts/sample-video.mp4（或任一支真實影片）、建立版本後，查詢該版本 API 與素材中心／投放中心畫面並截圖或紀錄。
- **其他環境（如 Linux 正式機）安裝與驗證**：本輪僅在當前 Windows 環境實跑；若正式環境為他機，需在該機依 docs/ffprobe-安裝與驗證.md 或同邏輯執行安裝與驗證。

---

## 3. 哪些只是先求可用

- **安裝文件**：以 Windows winget 為主；Linux/macOS 僅簡述，未在當輪實跑。
- **樣本影片**：使用 w3schools 小檔，僅供驗證偵測；未納入版控（已加入 .gitignore scripts/sample-*.mp4）。

---

## 4. 改了哪些檔案

| 檔案 | 修改目的 | 新增/修改/刪除 |
|------|----------|----------------|
| `docs/ffprobe-安裝與驗證.md` | 安裝方式、PATH 驗證、health check 實跑結果與指令 | 新增 |
| `docs/Phase-ffprobe安裝與success實證-完成回報.md` | 本回報與閉環判定、證據表 | 新增 |
| `.gitignore` | 新增 `scripts/sample-*.mp4` 避免提交下載之樣本影片 | 修改 |

**未改**：scripts/*.mjs、scripts/verify-video-detection.ts、server/client 業務碼。

---

## 5. 刻意沒改哪些檔案

- **左側、分析區、Meta 真發送、新 UI、warnings / groupSource / 模板 / 批次建組**：未動。
- **detect-media、ffprobe-health、publish-service、assets、publish-placeholder**：未改。

---

## 6. 驗收標準

1. **安裝**：在目標環境依文件安裝 ffmpeg/ffprobe，執行 `ffprobe -version` 成功。
2. **health check**：執行 `node scripts/run-ffprobe-check.mjs` 得 200 與 `{ "ok": true }`（或對 BASE_URL 執行 verify-ffprobe.mjs 得 200）。
3. **success**：以一支真實影片執行 `npx tsx scripts/verify-video-detection.ts <路徑>` 得 detectStatus: success、detectSource: metadata、aspectRatio 與 width/height/duration；可選：在應用內上傳該影片並確認寫入與 UI「真偵測」。
4. **證據**：至少留存 health check 成功輸出、該支影片偵測結果輸出；若有應用內上傳則留存 API 與 UI 截圖／紀錄。

---

## 7. Rollback

- **還原**：刪除 `docs/ffprobe-安裝與驗證.md`、`docs/Phase-ffprobe安裝與success實證-完成回報.md`；還原 `.gitignore` 中 `scripts/sample-*.mp4` 一行。
- **系統**：若需移除 ffprobe，Windows 可於「設定 → 應用程式」解除安裝 FFmpeg；PATH 會隨之變更。

---

## 8. 風險與防呆

- **PATH**：安裝後須重載或新開終端，否則 `node scripts/run-ffprobe-check.mjs` 可能仍報 ENOENT。
- **伺服器進程**：若應用以服務方式常駐，安裝 ffprobe 後可能需重啟進程才能在新 PATH 下執行。

---

## 9. 五點自我檢討

1. **應用內上傳→UI** 未在本輪自動執行，需人工在瀏覽器操作並截圖才能補齊「寫入＋UI」證據。
2. **正式環境** 若為他機，僅能依文件在該機重做安裝與驗證，本輪無法代跑。
3. **樣本影片** 為外站下載，未做長期存檔或版控，僅供本輪驗證。
4. **閉環宣稱** 區分為「偵測鏈路閉環」與「上傳→寫入→UI 閉環」，避免含糊。
5. **其他 OS** 安裝步驟僅簡述，未實跑。

---

## 10. 是否偏離規格

**沒有。** 本輪未做新 UI、新功能、Meta 真發送、左側／分析區、warnings/groupSource/模板/批次建組擴充；僅做 ffprobe 安裝、health check、success 實證與證據補齊。

---

## 11. 下一輪建議

- 在應用內上傳 **scripts/sample-video.mp4**（或任一支真實影片），建立版本後確認該版本 API 與素材中心／投放中心顯示「真偵測」與 metadata，並截圖留存，以宣告「上傳→偵測→寫入→UI」整條閉環。
- 若正式環境為 Linux 等，在該機依 docs/ffprobe-安裝與驗證.md 執行安裝與 `run-ffprobe-check.mjs`，並將結果補入回報。

---

# 實測結果與證據

## 1. 安裝與 PATH 驗證（實跑）

- **安裝指令**：`winget install -e --id BtbN.FFmpeg.GPL --accept-source-agreements --accept-package-agreements`
- **結果**：已成功安裝；PATH 已修改；新增別名 ffprobe。
- **PATH 驗證**：重載 PATH 後執行 `ffprobe -version`，輸出版本資訊，exit 0。

## 2. ffprobe health check（實跑）

- **指令**：`node scripts/run-ffprobe-check.mjs`（已重載 PATH）。
- **HTTP status**：**200**
- **Response body**：`{ "ok": true, "message": "ffprobe 可執行" }`
- **是否已從 503 ENOENT 變成 200 ok:true**：**是。**

## 3. 真實影片 success 證據（實跑）

- **影片**：scripts/sample-video.mp4（約 10 秒，320x176）。
- **指令**：`npx tsx scripts/verify-video-detection.ts scripts/sample-video.mp4`
- **結果**：
  - **detectStatus**：success  
  - **detectSource**：metadata  
  - **aspectRatio**：16:9  
  - **detectedWidth**：320，**detectedHeight**：176，**detectedDurationSeconds**：10  
  - **detectSource 是否為 metadata**：是  
  - **腳本輸出結論**：success（metadata 偵測成功）
- **UI 顯示「真偵測」**：同一支影片在應用內上傳並建立版本後，版本卡應顯示 Badge「真偵測」；本輪未執行瀏覽器操作，需依下方步驟補截圖。
- **該版本在素材中心與投放中心**：應顯示 16:9、真偵測 Badge；若有 metadata 欄位（如寬高、時長）一併留存。

## 4. 證據截圖／紀錄清單

| 項目 | 狀態 | 說明 |
|------|------|------|
| health check 成功結果 | 已留存 | 見上文「ffprobe health check（實跑）」 |
| 該支影片上傳後資料結果 | 腳本已取得 | 見上文「真實影片 success 證據」；應用內 API 回應需上傳後查版本 API 留存 |
| UI Badge「真偵測」 | 待補 | 上傳該影片並建立版本後，於素材中心與投放中心截圖 |
| metadata 欄位顯示 | 待補 | 若有版本詳情或 metadata 欄位，一併截圖 |

## 5. 應用內補齊「上傳→寫入→UI」步驟（建議）

1. 啟動應用（npm run dev 等），登入。
2. 在素材中心選擇或建立一個素材包，上傳 **scripts/sample-video.mp4**（或將該檔複製到可選路徑後上傳）。
3. 建立版本時確認表單帶入比例 16:9 與偵測結果，存檔。
4. 在素材中心版本卡確認 Badge「真偵測」、比例 16:9；若有寬高／時長顯示一併截圖。
5. 在投放中心選擇該素材包與該版本，確認版本區顯示「真偵測」Badge。
6. 可查詢 GET /api/asset-packages/:id/versions 或該版本資源，確認 response 含 detectedWidth/Height、detectedDurationSeconds、detectStatus: success、detectSource: metadata，留存回應或截圖。

---

# 最終判定

- **已閉環**：**影片偵測鏈路**（環境具 ffprobe → detectMedia 讀取 metadata → 回傳 success / metadata / aspectRatio）在當前環境已閉環；安裝、PATH 驗證、health check、真實影片 success 皆已實跑並有紀錄。
- **未閉環／待補**：**「上傳→寫入 DB→UI 顯示」** 端到端需在應用內完成一次上傳、建立版本、確認 API 與 UI，並留存截圖後，才可宣稱整條「上傳→偵測→寫入→UI」完全閉環；本輪未含糊寫「大致完成」，明確區分上述兩段。

---

# 額外必答

## A. ffprobe 現在是否已在可驗證環境中成功可用

**是。** 已在當前可控制環境以 winget 安裝 FFmpeg，重載 PATH 後 `ffprobe -version` 與 `node scripts/run-ffprobe-check.mjs` 均成功；回傳 200 與 `{ "ok": true }`，可驗證 ffprobe 可用。

## B. success 端到端證據是否已完整取得

- **detectMedia 端**：已完整取得（真實影片、success、metadata、16:9、320x176、10s）。
- **應用端（上傳→寫入→UI）**：未在本輪執行；需在應用內上傳該影片、建立版本後，取得 API 回應與「真偵測」UI 截圖，才算完整端到端證據。

## C. 現在能不能正式宣稱「影片偵測鏈路已閉環」

**能。** 正式宣稱：**影片偵測鏈路（ffprobe 可用 → detectMedia → success / metadata / aspectRatio）** 在當前環境已閉環；安裝、health check、真實影片 success 皆已實跑並有紀錄。  
**尚未宣稱**：「上傳→偵測→寫入 DB→UI 顯示」整條產品流程閉環，需補齊應用內上傳與 UI 證據後再宣稱。

## D. 如果還不能，最後缺口只剩哪一步

若以「整條產品流程（含 UI）」為閉環標準，**最後缺口**為：在應用內**上傳同一支（或任一支）真實影片 → 建立版本 → 確認該版本 API 含 success/metadata 且素材中心／投放中心顯示「真偵測」Badge**，並留存截圖或紀錄。補齊此步後即可宣稱整條閉環。
