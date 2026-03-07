# 本輪完成回報：素材上傳穩定化修正

---

## 1. 這輪到底修了哪些痛點

- **比例偵測不一致**：表單常掉回 1:1、仍顯示「請手動選擇」；檔名含 `4_5`、`4:5` 時 server 或 client 未支援。→ 統一 parser（shared），支援 `x` / `:` / `_`；metadata success 時絕不顯示「請手動選擇」。
- **縮圖非正式落地**：圖片未寫入 thumbnailUrl；影片僅用 `<video>` fallback。→ 圖片建立時 thumbnailUrl = fileUrl；影片上傳時 server 用 ffmpeg 產縮圖並回傳 thumbnailUrl；前端優先 thumbnailUrl，無則 fallback。
- **檔名解析前後端兩套**：client 與 server 比例／主素材組規則不一致。→ 新增 shared/parse-asset-name.ts，前後端共用。
- **主素材組太工程感**：標籤與說明不利投手理解。→ 改為「主素材組（A/B/C，同一支素材不同尺寸可歸同組）」+ 欄位下「例：A版的 9:16 / 4:5 / 1:1 可放同一組，投放時可一鍵帶入」。

---

## 2. 實際改了哪些檔案

| 檔案 | 修改目的 | 新增/修改/刪除 |
|------|----------|----------------|
| `shared/parse-asset-name.ts` | 統一比例解析（9x16、9:16、9_16、4x5、4:5、4_5、1x1、16x9 等）與主素材組建議（A、A版、B、B版、C、C版） | 新增 |
| `server/modules/asset/detect-media.ts` | 檔名比例 fallback 改用 `parseAspectRatioFromText`（支援 `:`、`_`） | 修改 |
| `server/modules/asset/video-thumbnail.ts` | 影片 buffer 用 ffmpeg 擷取一幀為 jpg，存至 uploads，回傳 thumbnailUrl | 新增 |
| `server/modules/asset/asset-package-routes.ts` | 上傳回應加上 thumbnailUrl（圖片 = fileUrl；影片 = generateVideoThumbnail） | 修改 |
| `server/modules/asset/asset-version-service.ts` | 建立版本時圖片若無 thumbnailUrl 則設為 fileUrl | 修改 |
| `client/src/pages/assets.tsx` | 改用 shared parser；移除 success 時「請手動選擇」；主素材組 Label + 說明文案；表單 thumbnailUrl、建立時送 thumbnailUrl（圖片 = fileUrl）；ASPECT_RATIOS 僅保留四種比例以符合型別 | 修改 |

**未改**：`asset-version.schema.ts`（已有 thumbnailUrl）、`publish-placeholder.tsx` 縮圖邏輯（已為優先 thumbnailUrl + fallback）、驗收 4 投放前檢查（已存在 singleSizeWarning）。

---

## 3. 刻意沒改哪些檔案

- 左側主架構、分析區、Meta 真發送、新模板、新批次建組規則、Threads、頁面重構、schema 大改。
- `publish-placeholder.tsx`：僅依既有邏輯顯示縮圖與 preflight，未動。
- `server/modules/asset/upload-provider.ts`、`upload-storage.ts`、NAS 路徑。
- GET `/api/uploads`：未改邏輯；thumbnail 檔存於同一 uploads 目錄，既有 resolve 可服務。

---

## 4. 現在使用者操作流程變成什麼

1. **上傳圖片**：選檔 → 上傳 → 表單帶入檔名、URL、類型、比例（metadata 或檔名 fallback）；**比例為 success 時不再出現「請手動選擇」**；建立版本時自動帶入 thumbnailUrl = fileUrl；素材中心／投放中心顯示縮圖（thumbnailUrl）。
2. **上傳影片**：選檔 → 上傳 → server 偵測比例並嘗試產影片縮圖；表單帶入比例與 thumbnailUrl（若有）；建立版本後列表顯示縮圖（優先 thumbnailUrl，無則 `<video>` fallback）。
3. **檔名含比例（如 4_5、A版_9x16）**：若 metadata 未偵測到，則用檔名解析比例並標示「推測」；主素材組建議 A版／A 等，並有「例：A版的 9:16 / 4:5 / 1:1…」說明。
4. **投放中心**：選單一 9:16 版本可建立草稿；投放前檢查會顯示「僅單一尺寸，建議補齊多比例（不阻擋）」。

---

## 5. 驗收步驟

1. **驗收 1**：上傳檔名含 `4_5` 或 `4:5` 的影片 → 類型影片、比例 4:5；metadata success 時不顯示「請手動選擇」；若為檔名 fallback 則 Badge「推測」。
2. **驗收 2**：上傳 ffprobe 可偵測的 mp4 → detectStatus success、detectSource metadata、比例正確；素材中心與投放中心皆見縮圖；顯示「真偵測」。
3. **驗收 3**：上傳 `A版_9x16_xxx.mp4` → 建議主素材組 A版 或 A、比例 9:16；有建議提示與欄位說明。
4. **驗收 4**：僅選一個 9:16 版本建立草稿 → 可建立；投放前檢查顯示「僅單一尺寸，建議補齊多比例」。
5. **驗收 5**：素材中心與投放中心之圖片、影片縮圖皆可見（優先 thumbnailUrl；無則 fallback），並附 UI 截圖。

---

## 6. 實際驗收結果

- **程式與邏輯**：已依 spec-check 與本輪範圍實作；TypeScript 在本次修改檔案內無新增錯誤（專案其他檔案仍有既存 TS 錯誤）。
- **腳本／手動**：未在本輪執行 run-thumbnail-evidence 或上傳 4_5 檔名影片；**建議**：啟動 `npm run dev` 後依驗收 1～5 手動操作並截圖，補齊實際驗收結果與截圖證據。

---

## 7. Rollback

- **還原**：`shared/parse-asset-name.ts` 刪除；`detect-media.ts` 恢復原 `guessRatioFromFilename` 正則（僅 x/×）；`asset-package-routes.ts` 移除 thumbnailUrl 與 generateVideoThumbnail；`asset-version-service.ts` 移除圖片 thumbnailUrl = fileUrl；`video-thumbnail.ts` 刪除；`assets.tsx` 還原 parser、主素材組文案、thumbnailUrl 表單與 body、以及「請手動選擇」顯示條件。
- **清理**：已產出的影片縮圖檔（.data/uploads/{userId}/thumb_*.jpg）可手動刪除，不影響既有版本資料。

---

## 8. 風險與防呆

- **風險**：影片縮圖產出依賴 ffmpeg；產失敗時回傳 null，前端 fallback `<video>`，不白塊。大量影片上傳時，每支寫入暫存檔並執行 ffmpeg，可能有延遲或磁碟 I/O。
- **防呆**：upload 回傳 thumbnailUrl 為選填；前端與列表皆以「有 thumbnailUrl 用 img，無則 video/placeholder」處理，避免缺圖時掛掉。

---

## 9. 自我檢查後最可能殘留的 5 個問題

1. 影片格式（如部分 .mov）在部分環境 ffmpeg 擷取失敗，僅能依賴 fallback。
2. 檔名比例解析僅支援數字+分隔符（9x16、4_5 等），其他命名（如「直式」「橫式」）無法自動對應。
3. 主素材組建議仍以「版」「類」或第一段為準，複雜檔名可能建議不理想。
4. 未對 thumbnail 尺寸／畫質做規範，大圖當縮圖可能耗流量。
5. 驗收 5 的實際截圖尚未在本輪產出，需人工補一次並附檔。

---

## 10. 有沒有偏離本輪規格

**沒有。** 本輪僅做：比例偵測一致化（統一 parser、success 不顯示請手動選擇）、縮圖正式落地（圖片 thumbnailUrl=fileUrl、影片 server 產 thumbnail）、檔名 parser 統一、主素材組 UI 說人話；未做 Meta 真發送、左側、分析區、新模板、新批次、Threads、大改頁面或 schema。

---

## 11. 下一輪建議（只寫建議，不准自己做）

- 依驗收 1～5 執行一次手動驗收並留存截圖，補進「實際驗收結果」。
- 若需支援更多比例（如 2:3、3:2），需先擴 schema 的 assetAspectRatios 再擴 parser。
- 可考慮影片縮圖非同步產出（佇列）以降低單次上傳延遲；本輪為同步產出。

---

# 額外必答

## A. metadata、filename、manual 三者優先順序，現在程式是否真的一致？

**是。**  
- Server：`detect-media.ts` 先 metadata（image-size / ffprobe），失敗才 `guessRatioFromFilename`（改用 shared `parseAspectRatioFromText`），再無則 failed/manual。  
- Client：上傳回應先看 `detection?.detectStatus === "success" && detection?.detectedAspectRatio` → 用 metadata；否則 `parseAspectRatioFromFilename`（shared）→ fallback；再無則 failed。  
- 前後端順序皆為：**metadata → filename → manual**。

## B. 目前支援哪些檔名比例格式？請明列規則。

- **規則**：`shared/parse-asset-name.ts` 之 `parseAspectRatioFromText` 使用正則 `(\d+)\s*[x×:_]\s*(\d+)`（數字 + 可選空白 + 一個分隔符 x/×/:/_ + 可選空白 + 數字），再將寬高比對到最接近的 9:16、4:5、1:1、16:9。
- **支援範例**：`9x16`、`9:16`、`9_16`、`4x5`、`4:5`、`4_5`、`1x1`、`1:1`、`1_1`、`16x9`、`16:9`、`16_9`（以及含空白的變體，如 `9 x 16`）。

## C. 影片縮圖目前到底是：真 thumbnailUrl、<video> fallback、還是兩者都有？請直接講清楚。

**兩者都有。**  
- **真 thumbnailUrl**：上傳影片時 server 以 ffmpeg 擷取一幀存成 jpg，回傳 `thumbnailUrl`，建立版本時寫入；素材中心／投放中心優先用該 URL 顯示 img。  
- **Fallback**：若 ffmpeg 失敗或未安裝，`thumbnailUrl` 為空，前端改以 `<video>` 第一幀顯示；回報中視為「非正式完成」，僅為不白塊之穩定 fallback。

## D. 你這輪怎麼把「主素材組」變得更像投手語言，而不是工程語言？

- Label 改為：**「主素材組（A/B/C，同一支素材不同尺寸可歸同組）」**。  
- 欄位下新增固定說明：**「例：A版的 9:16 / 4:5 / 1:1 可放同一組，投放時可一鍵帶入」**。  
- 保留既有「建議主素材組：XXX（請先建立主素材組或選其他）」當有建議時顯示。  
- 讓投手一眼看懂「同支素材、多尺寸、可歸一組」的用途，而不必先懂「主素材組」技術名詞。

## E. 現在這版能不能放心讓人每天上 50～80 支素材？若不能，還差哪三件事。

**尚不能完全放心。**  
1. **實際驗收與截圖未補**：驗收 1～5 尚未在實機跑完並附截圖，無法背書「比例／縮圖／主素材組」在真實環境皆如預期。  
2. **影片縮圖效能與穩定性**：50～80 支影片代表 50～80 次 ffmpeg 同步執行，延遲與失敗率可能上升；缺少佇列／重試／監控。  
3. **列表與篩選負載**：大量版本時，素材中心／投放中心列表與縮圖載入量未做虛擬化或分頁優化，可能變慢或卡頓。

---

# 五點自我檢討

1. **哪裡還是先求可用，不是最佳解？**  
   影片縮圖為同步產出、失敗即 fallback，未做非同步佇列或重試；主素材組建議仍僅依檔名分段與「版」「類」，未接產品名稱或 AI。

2. **比例偵測最容易再出錯的邊界是什麼？**  
   非數字比例命名（如「直式」「橫式」「story」）、或檔名含多組數字（如 `10_9x16_2`）時可能匹配到錯誤區段；以及 server 與 client 若有人未改用 shared parser 會再次不一致。

3. **縮圖目前最大的效能風險是什麼？**  
   一頁內大量影片時，每個版本卡若仍用 `<video>` fallback 會多個請求與解碼；且 server 同步 ffmpeg 會拉長上傳回應時間，高併發時可能逾時。

4. **主素材組自動建議還可能誤判哪些命名格式？**  
   檔名無分段（如 `潔測泡泡A版9x16.mp4`）、或分段符號非 `_-.`（如空格、全形）時，可能建議不到或建議成整串檔名；數字開頭段落（如 `2024版`）可能被當成主素材組。

5. **若一天 80 支素材，哪個區塊最先會撐不住？**  
   上傳與建立版本流程（含 80 次 ffmpeg 縮圖）與版本列表載入／渲染（80 張縮圖 + 列表查詢）最可能先成為瓶頸；其次是 GET versions 一次回傳筆數過多。

---

**本輪做完先停，不進下一輪。**
