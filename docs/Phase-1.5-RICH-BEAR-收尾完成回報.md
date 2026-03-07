# Phase 1.5 收尾完成回報 — 人格一致性收乾淨

依 Phase 1.5 必做兩項：**Base Core 永遠載入**、**/start 與正式判讀入口全部 workbench 對接**。以下為完成狀態與補充驗收要求之明確回答。

---

## 一、完成狀態

- **Base Core 永遠載入**：組裝邏輯已改為「Base Core 固定第一段，再疊加 published（若有）、再內層 A/B/C/D、再 calibration」。
- **/start 完全 workbench 對接**：`POST /api/content-judgment/start` 不再使用 storage；改為依 judgmentType 推得 uiMode → 取 published → `getAssembledSystemPrompt` ＋ `buildContentJudgmentUserPrompt`，傳入 `callGeminiContentJudgment(..., { systemPrompt, userPrompt })`。
- **四入口對應 mode**：判讀頁空狀態四張卡點擊時會先 `setUiMode(e.mode)` 再帶入預設 prompt，素材→creative、商品頁→boss、廣告數據→buyer、GA4→buyer。

---

## 二、補充驗收要求 — 4 點明確回答

### 1. Base Core 是否永遠載入？

**是。**

組裝函式路徑：`server/rich-bear-prompt-assembly.ts` 的 `getAssembledSystemPrompt(options)`。

實作：函式內第一段固定為 `const baseCore = getBaseCore();`，再依序 `[baseCore, ...(publishedOverlay ? [publishedOverlay] : []), ...modeParts, ...calibrationParts]`，故 Base Core 永遠為組裝的第一段。

### 2. published prompt 與 Base Core 的組裝順序是什麼？

**順序為：**

1. **Base Core**（永遠第一段）  
2. **該 mode 已發布主 prompt**（若有：`customMainPrompt` 非空時疊加）  
3. **對應內層 A/B/C/D 模式片段**（依 uiMode 或 judgmentType）  
4. **對應 Hidden Calibration 片段**（依 uiMode）

程式碼位置同上，`parts = [baseCore, ...(publishedOverlay ? [publishedOverlay] : []), ...modeParts, ...calibrationParts]`。

### 3. `/start` 是否已完全移除 storage prompt 依賴？

**是。**

- `POST /api/content-judgment/start` 現在依 `contentType` → `judgmentType` → `suggestUIModeFromJudgmentType` 得到 `uiMode`，再 `getPublishedPrompt(uiMode)`、`getAssembledSystemPrompt({ uiMode, customMainPrompt: publishedMain, judgmentType })`、`buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType)`，並以 `{ systemPrompt, userPrompt }` 傳入 `callGeminiContentJudgment(..., overrides)`。
- `callGeminiContentJudgment` 在收到 `overrides` 時只使用傳入的 `systemPrompt` 與 `userPrompt`，不再呼叫 `buildContentJudgmentPrompt(settings, ...)` 取得 system prompt，故不再依賴 `storage.coreMasterPrompt` / `storage.modeXPrompt`。

### 4. 四個入口（素材 / 商品頁 / 廣告數據 / GA4 漏斗）各自對應哪個 mode？

| 入口         | 對應 mode   |
|--------------|-------------|
| 素材審判     | **creative** |
| 商品頁審判   | **boss**     |
| 廣告數據審判 | **buyer**    |
| GA4 漏斗審判 | **buyer**    |

實作：`client/src/pages/judgment.tsx` 的 `EMPTY_ENTRIES` 每筆有 `mode: UIMode`，點擊時先 `setUiMode(e.mode)` 再 `handleQuickPrompt(e.prompt)`，送出時 request body 會帶當前 `uiMode`。

---

## 三、驗收案例（4 則）

1. **修改創意模式 published prompt，素材審判輸出確實改變**  
   - 到「Prompt 設定」→ 創意模式，編輯 Draft 並發布（例如加一句「請在每段結尾加上『以上，熊總監』」）。  
   - 到「RICH BEAR 審判官」→ 選創意模式（或點空狀態「素材審判」），送出一則素材相關問題。  
   - **預期**：回覆風格或結尾符合剛發布的創意模式主 prompt，與未修改前有可辨差異。

2. **創意模式無 published prompt 時，輸出仍保有 Rich Bear 核心語氣與判決感**  
   - 創意模式不發布任何主 prompt（或回滾到無已發布版本）。  
   - 同上頁、創意模式，送出一則素材相關問題。  
   - **預期**：僅有 Base Core ＋ 內層 A/B ＋ calibration，回覆仍具嚴格評分、直接、可執行的判決感（30–55 分常態、低分急迫等），不會變成一般客服口吻。

3. **修改舊 storage prompt 不再影響 judgment chat**  
   - 若有「設定中心」或 storage 可改 `systemPrompt` / `coreMasterPrompt`，將其改為明顯不同內容（例如「你是溫柔小助手」）。  
   - 在判讀頁用任一模式送出一則訊息。  
   - **預期**：判讀回覆仍為 RICH BEAR 審判官人格（Base Core ＋ 該 mode 已發布 ＋ 內層 ＋ calibration），不受 storage 修改影響。

4. **四個入口確實會走不同 mode，而不是全部默認 creative**  
   - 依序點「素材審判」「商品頁審判」「廣告數據審判」「GA4 漏斗審判」，每次點完後在左側「常用審判模式」查看目前選中按鈕。  
   - **預期**：點素材審判後為「創意模式」、點商品頁後為「Boss 模式」、點廣告數據或 GA4 後為「投手模式」。再送出訊息時，後端日誌或行為應依該 uiMode 載入對應 published ＋ 內層 B/C/D 或 A/B（創意為 A,B；Boss 為 B,C,D；投手為 C,D）。

---

## 四、實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `server/rich-bear-prompt-assembly.ts` | 組裝改為：先 `baseCore = getBaseCore()` 固定第一段，再 `publishedOverlay`（若有）、再 mode parts、再 calibration；註解與介面說明改為「疊加」而非「取代 Base Core」。 |
| `server/prompt-builder.ts` | 新增 `buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType)`；`buildContentJudgmentPrompt` 的 user 部分改為呼叫該函式。 |
| `server/gemini.ts` | 新增 `ContentJudgmentOverrides`；`callGeminiContentJudgment` 增加最後參數 `overrides?: { systemPrompt, userPrompt }`，有則用 overrides，無則沿用 `buildContentJudgmentPrompt`。 |
| `server/routes.ts` | `/api/content-judgment/start`：依 judgmentType 算 uiMode、取 published、組裝 systemPrompt、建 userPrompt，以 overrides 呼叫 `callGeminiContentJudgment`；新增 `buildContentJudgmentUserPrompt` 與 `suggestUIModeFromJudgmentType`、`AssemblyJudgmentType` 引用。 |
| `client/src/pages/judgment.tsx` | `EMPTY_ENTRIES` 每筆新增 `mode: UIMode`（material→creative, landing→boss, ads/ga4→buyer）；點擊入口時先 `setUiMode(e.mode)` 再 `handleQuickPrompt(e.prompt)`。 |

---

## 五、Prompt 對接說明（Phase 1.5 重點）

- **Chat**：與 Phase 1 相同，一律 `getAssembledSystemPrompt`；差異為組裝內 **Base Core 永遠第一段**，published 為疊加而非取代。
- **/start**：不再使用 storage。依 `contentType` → `judgmentType` → `uiMode` → workbench published ＋ `getAssembledSystemPrompt`（同一組裝順序）＋ `buildContentJudgmentUserPrompt`，經 overrides 傳入 `callGeminiContentJudgment`。
- **其他正式判讀**：目前僅 chat 與 /start 為判讀入口，兩者皆已 workbench 對接，未再使用 `storage.systemPrompt` / `coreMasterPrompt`。

---

## 六、驗收步驟（簡要）

1. 依「二、4」確認四入口對應 mode 在 UI 上正確（點入口後左側模式按鈕與送出之 uiMode 一致）。  
2. 依「三、驗收案例」執行 4 則案例並符合預期。  
3. 可選：在 `getAssembledSystemPrompt` 內暫時 log 組裝後首段字首，確認首段為 Base Core 內容。

---

**Phase 1.5 到此收尾，可放行 Phase 2。**
