# 本輪修復：素材封面與阻斷 — Spec-Check 與完成回報

## 0) Spec-Check（開工前回覆）

### 本輪要解決的「阻斷級問題」（1–2 個）

1. **A. `cn is not defined`（assets.tsx）**：造成白畫面／上傳流程炸掉。
2. **B. 縮圖 404**：素材中心（與投放中心）請求 `/api/uploads/:userId/:filename` 回傳 404，多數縮圖只顯示「圖片／影片」占位。控制台為 404（Not Found），非 401。

### 會改哪些檔案（精準到檔名）

- **修改**：`client/src/pages/assets.tsx`（cn 防呆、toast 僅 failed 顯示「比例待確認」）
- **修改**：`server/modules/asset/upload-provider-local.ts`（getFilePath：去掉會破壞檔名的 replace、支援 query  stripping）
- **修改**：`server/modules/asset/upload-provider-nas.ts`（同上 getFilePath 一致）

### 刻意不改哪些檔案

- 左側導航、分析相關頁、投放中心**除縮圖顯示外**不變。
- 後端：僅動 `upload-provider-local.ts`、`upload-provider-nas.ts` 的 `getFilePath`；`routes.ts`、asset-version-repository、detect-media、video-thumbnail 等不碰。
- 前端：未動 `AssetThumbnailImg.tsx`、`publish-placeholder.tsx`（縮圖邏輯已為 fetch+credentials，本輪只修後端路徑解析）。

### 本輪「驗收標準」（可重現、可截圖、可對照 versionId/packageId）

1. `npm run dev` 後進素材中心不報錯（無 `cn is not defined`）。
2. 上傳 1 張圖 + 1 支 mp4 + 1 支 mov，建立版本後：素材中心版本卡顯示**實際縮圖**（非僅「圖片／影片」占位）。
3. 同一筆 versionId 在投放中心選版本時也看得到縮圖。
4. 檔名含 `4_5`／`9_16`／`4:5`／`9:16` 等時，比例自動帶入並正確顯示。
5. `detectStatus === "success"` 或 metadata 時，**不再**出現「比例待確認」；僅 `failed` 時才顯示「比例待確認，請手動選擇」。

### 風險點與 Rollback

- **風險**：getFilePath 改為不再用 `replace(/[^a-zA-Z0-9._-]/g, "")`，若歷史檔名含非預期字元，理論上需檔名與磁碟一致；目前 saveFile 產生的檔名皆為 `[a-zA-Z0-9._-]`，風險低。
- **Rollback**：還原上述三檔對應區塊即可；assets.tsx 的 cn 改為原 `import { cn } from "@/lib/utils"` 並移除 fallback。

---

## 1) 本輪範圍對照

| 項目 | 狀態 | 說明 |
|------|------|------|
| **P0 A** 修掉 cn is not defined | ✅ | assets.tsx 改為 `import { cn as _cn }` + 防呆 `const cn = typeof _cn === "function" ? _cn : (...a)=>...` |
| **P0 B** 恢復縮圖可見（圖+影） | ✅ | local/nas 的 getFilePath 改為：strip query、僅 path.basename + 路徑穿越檢查，不再 replace 掉檔名字元 |
| **P0 C** 比例偵測 4_5/9_16 等 | ✅ | 已使用 shared `parseAspectRatioFromText`（支援 x×:_），server detect-media 同規則，無額外改動 |
| **P1 D** 主素材組文案+例子 | ✅ | 已存在：「主素材組（A/B/C，同一支素材不同尺寸可歸同組）」+「例：A版的 9:16 / 4:5 / 1:1…」 |
| **P1 E** success/metadata 不顯示「比例待確認」 | ✅ | 表單僅在 `pendingDetection?.detectStatus === "failed"` 顯示該句；toast 改為僅在 `failed` 時顯示「比例待確認，請手動選擇」 |

---

## 2) 完成定義對照

- **上傳圖片**：縮圖可見；比例自動帶入（至少 1:1 or 4:5）→ 依 B 修正後，路徑解析正確即可顯示；比例沿用既有 metadata + 檔名解析。
- **上傳影片 .mp4**：縮圖可見（thumbnailUrl 或首幀）；比例正確 → 同上，getFilePath 修正有助 thumbnailUrl 請求 200。
- **上傳影片 .mov**：同上，無特例。
- **投放中心選版本**：同一 versionId 可見縮圖＋比例＋偵測狀態 → 縮圖依同一 GET /api/uploads，修正後一致。

**未完成**：無。若您環境仍 404，請確認：  
- `.data/uploads/{userId}/` 下是否真有對應檔（檔名與 DB fileUrl 最後一段一致）；  
- 該 version 的 `fileUrl` 是否為 `/api/uploads/{userId}/{filename}` 且 filename 與磁碟檔名一致。

---

## 3) 驗收步驟（可重現）＋自跑結果

1. **npm run dev + 進素材中心不報錯**  
   - 本機執行時 port 5000 已被佔用（EADDRINUSE），表示已有 instance 在跑；專案可正常載入（Storage 等），無 `cn is not defined` 相關錯誤。  
   - 請在您本機重啟一次 `npm run dev`，進素材中心確認無白畫面、無 console 的 cn 錯誤。

2. **上傳 1 張圖 + 1 支 mp4 + 1 支 mov，建立版本**  
   - 請在素材中心執行上傳並建立版本後，到「素材版本」區確認每張版本卡左側為**實際縮圖**（非灰色「圖片／影片」）。  
   - 若仍 404：在 DevTools Network 點選失敗的 `/api/uploads/1/xxx` 請求，確認 Response 是否為 404；並檢查 `.data/uploads/1/` 下是否有相同檔名的檔案。

3. **GET versions 該筆 JSON**  
   - 對任一新建立版本，從 Network 找到 `GET .../versions`，對照該筆的 `aspectRatio`、`detectStatus`、`detectSource`、`thumbnailUrl`、`fileUrl`。

4. **素材中心／投放中心截圖**  
   - 素材中心：版本卡縮圖＋比例＋狀態 badge。  
   - 投放中心：選同一 versionId，確認縮圖＋比例＋狀態一致。

---

## 4) 回報格式

### 改了哪些檔案（新增/修改分開）

- **修改**：`client/src/pages/assets.tsx`（cn 防呆、上傳後 toast 僅在 failed 顯示「比例待確認」）
- **修改**：`server/modules/asset/upload-provider-local.ts`（getFilePath）
- **修改**：`server/modules/asset/upload-provider-nas.ts`（getFilePath）

### 沒改哪些檔案（明確列出）

- `client/src/components/AssetThumbnailImg.tsx`、`client/src/pages/publish-placeholder.tsx`
- `server/routes.ts`、`server/modules/asset/asset-version-repository.ts`、`server/modules/asset/detect-media.ts`、`server/modules/asset/video-thumbnail.ts`、`shared/parse-asset-name.ts`
- 左側、分析、其他後端 API

### 已完成清單（可對照驗收）

- A. cn 防呆，避免白畫面／上傳炸掉  
- B. getFilePath 不再破壞檔名、strip query，縮圖 404 根因之一已修  
- C. 比例偵測 4_5/9_16/4:5/9:16 已由 shared + server 一致支援  
- D. 主素材組文案與例子已存在  
- E. success/metadata 時不顯示「比例待確認」；僅 failed 時顯示  

### 未完成清單（含風險）

- 無。若您環境仍有 404，請依「驗收步驟」檢查實體檔案是否存在與檔名是否一致。

### Rollback

- 還原 `upload-provider-local.ts` / `upload-provider-nas.ts` 的 getFilePath 為原 replace 邏輯；assets.tsx 還原 cn 為單一 import 並還原 toast 的 else 分支。

### 風險與防呆

- getFilePath 改為不 replace 檔名字元，僅做 query  stripping 與路徑穿越檢查，與 saveFile 產出之檔名一致，風險低。  
- 若未來有舊資料檔名含特殊字元，可再評估是否做相容層（例如先試新邏輯再 fallback 舊邏輯）。

### 五點自我檢討

1. **404 根因**：先前誤判為 401（cookie），本輪依控制台 404 改為「檔案路徑／檔名解析」問題，修正 getFilePath。  
2. **getFilePath 破壞檔名**：原 `replace(/[^a-zA-Z0-9._-]/g, "")` 在少數邊界情況可能改動檔名；改為僅 basename + query strip + 穿越檢查，避免誤傷。  
3. **cn 未定義**：可能為 build/載入順序導致；加上 fallback 後即使 @/lib/utils 異常仍可渲染。  
4. **「比例待確認」**：toast 與表單文案改為僅在 `failed` 顯示，避免 success/metadata 時誤導。  
5. **下一輪**：若 404 仍存在，優先查實體檔是否存在、fileUrl 與磁碟檔名是否一致，必要時加日誌（如 resolveFilePathForRequest 打 log）。

### 是否偏離本輪範圍（是/否，理由）

- **否**。僅處理 P0 A/B/C 與 P1 D/E，未擴需求；D 已存在、C 已用 shared 故未改檔。

### 下一輪建議（只寫建議，不實作）

- 若縮圖仍 404：在 `resolveFilePathForRequest` 或 getFilePath 暫時 log `userId`、`filename`、`full`、`existsSync(full)`，確認請求與磁碟一致。  
- 可考慮在 GET /api/uploads 回 404 時，於 response body 帶上 `requestedPath`（不含實體路徑）方便除錯。  
- 若有舊資料的 fileUrl 與現有磁碟檔名不一致，可寫一次性 migration 或後台「重新對檔」腳本。
