# UI 閉環驗證 Runbook：上傳 → 寫入 → UI 顯示「真偵測」

## 目的

用已成功偵測的真實影片（如 `scripts/sample-video.mp4`），在應用內完成上傳、建立版本、寫入資料，並確認素材中心與投放中心顯示「真偵測」Badge，以取得整條產品流程閉環證據。

## 鏈路與層級（若斷裂時對照）

| 步驟 | 層級 | 說明 |
|------|------|------|
| 1. 上傳 | upload route | POST `/api/asset-packages/:id/versions/upload`：multer → saveFile → **detectMedia(buffer, mime, fileName)** → res.json({ ...result, **detection** }) |
| 2. 前端帶入 | 前端 | 上傳回應取 `detection`，setPendingDetection(detection)，versionForm.aspectRatio = detection.detectedAspectRatio |
| 3. 建立版本 | 前端 | 送出時 body 含 detectedWidth/Height、detectedAspectRatio、detectedDurationSeconds、detectStatus、detectSource（來自 pendingDetection） |
| 4. 寫入 | service + schema + repository | assetVersionService.create 解析 body；assetVersionCreateSchema 含上述欄位；versionRepo.create 存完整 version |
| 5. 讀出 | API | GET `/api/asset-packages/:id/versions` 回傳 listByPackageId，每筆為完整 AssetVersion（含 detectStatus 等） |
| 6. 素材中心 UI | 前端 assets.tsx | 版本卡依 `v.detectStatus` 顯示 Badge，success →「真偵測」 |
| 7. 投放中心 UI | 前端 publish-placeholder.tsx | 版本列表依 `v.detectStatus` 顯示 Badge，success →「真偵測」 |

若某一步結果不符，依上表對應層級排查（upload route / 前端帶入 / service / schema / repository / API / 前端顯示）。

## 操作步驟

1. **準備影片**  
   使用已驗證會跑出 success 的影片（如 `scripts/sample-video.mp4`，或本機任一支 ffprobe 可讀的影片）。

2. **啟動應用**  
   `npm run dev`，瀏覽器開啟 `http://127.0.0.1:5000`，登入（例如 admin / admin123）。

3. **素材中心**  
   - 左側選一個素材包（或新增一個）。  
   - 點「新增版本」或「上傳版本」。  
   - 點「選擇檔案上傳」，選 `scripts/sample-video.mp4`（或上述影片）。  
   - 確認上傳成功後表單帶入：檔名、URL、類型（影片）、**比例（應為 16:9 等偵測結果）**；toast 應為「已帶入檔名、URL、類型與比例（已從檔案偵測）」。  
   - 必要時補主素材組等，點「建立」存檔。

4. **驗證素材中心 UI**  
   - 該版本卡上應出現 Badge **「真偵測」**。  
   - 若有顯示 metadata（寬高、時長），確認與偵測結果一致。

5. **驗證 API 寫入**  
   - 開啟開發者工具 → Network，或呼叫 `GET /api/asset-packages/:id/versions`（:id 為該素材包 id）。  
   - 找到剛建立的版本，確認 response 含：`detectStatus: "success"`、`detectSource: "metadata"`、`aspectRatio`、`detectedWidth`、`detectedHeight`、`detectedDurationSeconds`。

6. **投放中心**  
   - 進入投放中心，選擇同一素材包。  
   - 在「選素材版本」區塊中，該版本應顯示 Badge **「真偵測」**。

7. **留存證據**  
   - 截圖：素材中心版本卡「真偵測」Badge、投放中心該版本「真偵測」Badge。  
   - 可選：API 回應截圖或 JSON 片段（含 detectStatus、detectSource、aspectRatio、detected*）。

## 若某一段沒接上

- **上傳後表單無比例或無「從檔案偵測」toast**  
  檢查：upload 回應是否有 `detection`；前端是否取 `data.detection` 並 setPendingDetection。  
  對應：upload route 是否回傳 detection；前端 handleVersionFileUpload。

- **建立版本後 API 無 detectStatus / detected***  
  檢查：前端 saveVersion 是否帶入 pendingDetection 各欄位；後端 assetVersionCreateSchema 是否含這些欄位；assetVersionService.create 是否寫入 version 物件。  
  對應：前端 body 組裝；server asset-version.schema.ts；asset-version-service.ts。

- **版本列表 API 有但 UI 無「真偵測」**  
  檢查：GET versions 回傳之每筆是否有 detectStatus；前端是否依 `v.detectStatus === "success"` 顯示「真偵測」。  
  對應：asset-version-repository 是否存/讀完整物件；assets.tsx / publish-placeholder.tsx Badge 條件。
