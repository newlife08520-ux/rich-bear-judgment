# Phase 1 完成回報 — RICH BEAR 審判官（品牌統一、Prompt 對接、頁面自解釋）

依 `docs/RICH-BEAR-產品整理-需求審查與規格對照.md` 施工藍圖，僅實作 **Phase 1**，不涉及 Phase 2～4。

---

## 1. 完成狀態

**Phase 1 已完成。**

- Prompt 對接：判讀 chat 已改為依 workbench published prompt ＋ hidden calibration 片段組裝，未發布時 fallback 明確（不用 draft、不讀 storage）。
- 品牌命名：側欄、判讀頁主／副標、空狀態四入口與「拿判決」說明、決策卡標題均已品牌化。
- Prompt 設定頁：三模式 tab、已發布區（模式名／發布時間／發布者／摘要）、Draft 說明、Hidden Calibration 只讀區均已就位。

---

## 2. 已完成項目

### 2.1 Prompt 對接

- Judgment chat（`POST /api/content-judgment/chat`）**一律**依 mode 使用 workbench 組裝：
  - 依 `uiMode`（boss / buyer / creative）讀取 `getPublishedPrompt(mode)` 作為主 prompt；未帶或無效時後端預設 `creative`。
  - 組裝：主 prompt（已發布內容，若有）＋ 內層 A/B/C/D 模式片段 ＋ Hidden Calibration 片段（`getAssembledSystemPrompt`）。
- **未發布時 fallback**：該 mode 尚無已發布時，`customMainPrompt` 為 null，組裝層僅使用 **Base Core**（人格核心＋分數哲學）＋ 對應內層模式（A/B/C/D）＋ 校準片段；**不自動吃 draft**，**不讀 storage 的 systemPrompt / coreMasterPrompt**。
- 內部四模式執行層（A 素材煉金術、B 轉單說服力、C 廣告投放判決、D 漏斗斷點審判）保留於 `rich-bear-persona.ts` 與 `rich-bear-prompt-assembly.ts`，未刪除、未簡化成單層。

### 2.2 品牌命名

- **側欄**：`app-sidebar.tsx` 導航項為「RICH BEAR 審判官」。
- **判讀頁**：
  - 主標：「RICH BEAR 審判官」。
  - 副標：「王牌爆款陪跑行銷總監｜判讀素材、頁面、廣告與漏斗」。
  - 決策卡區標題：「RICH BEAR 審判官決策卡（規則引擎產出）」。
- **空狀態**：改為裁決入口式：
  - 主句：「今日可審判 — 拿判決，不是純聊天」。
  - 副句：「選擇審判類型或輸入你的問題，總監會給出可執行的裁決與建議」。
  - 四張入口卡：素材審判、商品頁審判、廣告數據審判、GA4 漏斗審判（點擊帶入對應預設 prompt）。
- **任務頁**：`tasks.tsx` 文案為「RICH BEAR 審判官一鍵生成」。
- 輸入區下方說明改為：「判讀依『Prompt 設定』該模式已發布主 prompt ＋ 系統校準。」

### 2.3 Prompt 設定頁

- **模式 tab**：Boss 模式 / 投手模式 / 創意模式。
- **已發布區**：模式名稱、發布時間（若有）、發布者（目前 API 未回傳，顯示「—」）、目前使用中的主 prompt 摘要（前 3 行）、回滾鈕。
- **Draft 區**：說明「此區只編輯主 prompt，不包含 Hidden Calibration。」；儲存 Draft、發布鈕。
- **Hidden Calibration 已啟用（只讀）**：顯示已啟用校準模組名稱（來自 `GET /api/workbench/calibration-modules`），說明「系統已啟用以下校準模組，一般角色不可編輯全文。」

---

## 3. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `server/routes.ts` | Chat 一律用 workbench 組裝：effectiveMode（缺省 creative）→ getPublishedPrompt(effectiveMode) → getAssembledSystemPrompt；移除對 storage.systemPrompt / coreMasterPrompt 的 fallback。 |
| `client/src/pages/judgment.tsx` | 主標維持、副標改為藍圖文案；決策卡區標題改為「RICH BEAR 審判官決策卡」；空狀態改為「今日可審判 — 拿判決，不是純聊天」＋ 四入口；輸入區說明改為依 Prompt 設定與系統校準。 |
| `client/src/components/app-sidebar.tsx` | 先前已改為「RICH BEAR 審判官」，本輪未再改。 |
| `client/src/pages/tasks.tsx` | 先前已改為「RICH BEAR 審判官一鍵生成」，本輪未再改。 |
| `client/src/pages/settings-prompts.tsx` | 先前已具三區塊與 calibration 只讀，本輪未改。 |

---

## 4. Prompt 對接說明（Phase 1 重點）

- **來源**：判讀 chat 的 system prompt **只**來自：
  1. 該 mode 的 **已發布** 主 prompt（workbench `getPublishedPrompt(mode)`），若無則為 null；
  2. **Base Core**（`rich-bear-persona.ts`，角色核心＋分數哲學）；
  3. **內層四模式** A/B/C/D（依 uiMode 對應：Boss→B,C,D；投手→C,D；創意→A,B）；
  4. **Hidden Calibration** 片段（依 mode 載入，見 `rich-bear-calibration.ts` 與 `getCalibrationParts`）。
- **不使用的來源**：不使用 storage 的 `systemPrompt` 或 `coreMasterPrompt`；不使用 draft；未發布時僅以 Base Core ＋ 內層 ＋ calibration 組裝。
- **前端**：審判頁有 uiMode state（Boss / 投手 / 創意），發送 chat 時帶 `uiMode`；若未帶，後端以 `creative` 為預設。
- **/start 單次報告**：`POST /api/content-judgment/start` 仍使用 `callGeminiContentJudgment(settings, ...)`（storage 的 coreMasterPrompt + mode），未在 Phase 1 改動；若要一致改為 workbench，可列為後續項目。

---

## 5. 驗收步驟

1. **Prompt 對接**
   - 到「Prompt 設定」選創意模式，發布一版主 prompt（或留空不發布）。
   - 到「RICH BEAR 審判官」頁，選創意模式，送出一則訊息。
   - 確認有回覆（未發布時應為 Base Core ＋ 模式 A/B ＋ 校準的判讀風格）。
   - 確認後端日誌或行為：未再讀取 storage 的 systemPrompt/coreMasterPrompt。
2. **品牌與入口**
   - 側欄見「RICH BEAR 審判官」。
   - 判讀頁主標「RICH BEAR 審判官」、副標「王牌爆款陪跑行銷總監｜判讀素材、頁面、廣告與漏斗」。
   - 無對話時可見空狀態：「今日可審判 — 拿判決，不是純聊天」與四張入口卡。
   - 決策卡區標題為「RICH BEAR 審判官決策卡（規則引擎產出）」。
3. **Prompt 設定頁**
   - 三個 tab：Boss / 投手 / 創意。
   - 已發布區有模式名、發布時間、發布者（—）、摘要。
   - Draft 區有「此區只編輯主 prompt，不包含 Hidden Calibration」。
   - Hidden Calibration 區為只讀、列出校準模組名稱。

---

## 6. 未完成與原因

- **無。** Phase 1 範圍內項目均已完成。
- **刻意未做**：
  - `/api/content-judgment/start` 未改為 workbench（保留原 storage 路徑），可列為後續對接項目。
  - 全站其餘「AI 判讀」「AI 審判」文案（如 settings.tsx、history 等）未在本輪替換，屬 Phase 1 外或後續文案統一。

---

## 7. 截圖

請在實際環境執行上述驗收步驟後，自行擷取以下畫面並貼入本文件或附檔：

- 側欄（RICH BEAR 審判官）
- 判讀頁（主標、副標、空狀態四入口）
- 判讀頁（RICH BEAR 審判官決策卡區）
- Prompt 設定頁（三 tab、已發布、Draft、Hidden Calibration 只讀）

---

**Phase 1 到此為止，待驗收後再進行 Phase 2。**
