# RICH BEAR 審判官 — 人格保真重構交付報告

## 一、品牌命名

- **產品名稱**：由「AI 判讀中心」改為 **RICH BEAR 審判官**
- **頁面主標**：RICH BEAR 審判官
- **副標**：華麗熊・王牌爆款陪跑行銷總監

已套用於：審判頁標題、側欄導航、任務頁文案。

---

## 二、人格架構保真說明

### 2.1 哪些段落為「保留原文」

以下內容**未改寫**，僅做區塊標題或換行整理，語感與字句與 `storage` 預設一致：

| 區塊 | 來源 | 說明 |
|------|------|------|
| **【角色核心 Identity・最高任務 Mission】** | `storage.coreMasterPrompt` 第一段 | 原文：「你是『AI 行銷審判官』… 而不是讓他們感覺良好。」 |
| **【分數哲學 Score Philosophy】** | `storage.coreMasterPrompt` 第二段 | 原文：「評分標準：普通素材通常在 30-55 分… 急迫感。」 |
| **【素材煉金術模式】MODE_A** | `storage.modeAPrompt` | 全文照錄，含五維度（鉤子、情緒、視覺記憶、轉換、CTA）。 |
| **【轉單說服力模式】MODE_B** | `storage.modeBPrompt` | 全文照錄，含說服流程、信任、價格、掉單、行動裝置。 |
| **【廣告投放判決模式】MODE_C** | `storage.modeCPrompt` | 全文照錄，含素材健康、受眾、疲勞、預算、擴量。 |
| **【漏斗斷點審判模式】MODE_D** | `storage.modeDPrompt` | 全文照錄，含著陸、產品頁、購物車、結帳、漏斗健康。 |

以上皆存放於 `server/rich-bear-persona.ts`，對外僅做結構化標註（如加上【角色核心 Identity・最高任務 Mission】），**未做壓縮或改寫**。

### 2.2 哪些為「僅結構整理」

- **Base Core**：將原本 `coreMasterPrompt` 的兩段加上兩個小標（【角色核心 Identity・最高任務 Mission】與【分數哲學 Score Philosophy】），方便與其他 Layer 組裝，**未改字句**。
- **四模式**：以常數 `MODE_A`～`MODE_D` 與 `MODE_BY_KEY` 整理，內容與 storage 一致，僅做模組化與匯出。

### 2.3 哪些做成 Hidden Calibration slice

Layer 3 隱性校準為四個獨立 slice，**不與主 prompt / Draft 混在同一編輯框**，設定頁僅顯示「已啟用模組名稱」摘要：

| Slice 名稱 | 對應常數 | 用途 |
|------------|----------|------|
| Emotional Trigger | `CALIBRATION_SLICE_EMOTIONAL_TRIGGER` | 情緒觸發、共鳴門檻 |
| Visual Impact | `CALIBRATION_SLICE_VISUAL_IMPACT` | 前 3 秒、滑動記憶、品牌與轉換訊號 |
| Brand x Conversion Balance | `CALIBRATION_SLICE_BRAND_CONVERSION` | 品牌調性與賣貨平衡、具體可執行建議 |
| Example Calibration | `CALIBRATION_SLICE_EXAMPLE` | 爆款／失敗範例參照、改動方向 |

定義於 `server/rich-bear-calibration.ts`；`CALIBRATION_MODULE_NAMES` 供設定頁唯讀顯示，不暴露全文。

---

## 三、三模式（UI）對應四模式（執行層）

### 3.1 對應表

| UI 模式（tab） | 內層執行模式（優先順序） | 說明 |
|----------------|---------------------------|------|
| **Boss 模式** | B → C → D | 轉單說服力 + 廣告投放判決 + 漏斗斷點 |
| **投手模式** | C → D | 廣告投放判決 + 漏斗斷點 |
| **創意模式** | A → B | 素材煉金術 + 轉單說服力（必要時） |

實作位置：`server/rich-bear-prompt-assembly.ts` 之 `UI_MODE_TO_INTERNAL`。

### 3.2 載入策略（片段組裝）

- **創意模式**：Base Core + 模式 A + 模式 B + Emotional Trigger + Visual Impact + Brand×Conversion + Example Calibration  
- **投手模式**：Base Core + 模式 C + 模式 D + Brand×Conversion + 少量 Emotional Trigger  
- **Boss 模式**：Base Core + 模式 B + 模式 C + 模式 D + Emotional Trigger + Brand×Conversion  

不送兩份全文，僅依 `uiMode` 與可選 `judgmentType` 組裝必要片段。

---

## 四、實作清單

### 4.1 後端

- **人格來源**：`server/rich-bear-persona.ts` — Base Core + 四模式原文保真  
- **Hidden Calibration**：`server/rich-bear-calibration.ts` — 四 slice + `CALIBRATION_MODULE_NAMES`  
- **片段組裝**：`server/rich-bear-prompt-assembly.ts` — 三模式→四模式 + 校準載入  
- **API**  
  - `POST /api/content-judgment/chat`：可選 `uiMode`（boss/buyer/creative），有則用 `getAssembledSystemPrompt`，無則沿用設定頁 systemPrompt  
  - `GET /api/workbench/prompts/:mode`：回傳 `published`、`draft`、`publishedAt`、`publishedSummary`  
  - `GET /api/workbench/calibration-modules`：回傳已啟用校準模組名稱（只讀摘要）

### 4.2 前端

- **審判頁** `client/src/pages/judgment.tsx`  
  - 主標「RICH BEAR 審判官」、副標「華麗熊・王牌爆款陪跑行銷總監」  
  - 左側：常用審判模式（Boss/投手/創意）、最近模板、快速上傳素材、快速入口（商品作戰室、今日決策中心、素材生命週期）  
  - 空狀態：四大入口（素材審判、商品頁審判、廣告數據審判、GA4 漏斗審判）  
  - 右側證據區：資料來源標示（Meta · GA4 · ROI 漏斗規則引擎 · 任務與歷史操作）  
  - 發送 chat 時帶入當前 `uiMode`  
- **Prompt 設定頁** `client/src/pages/settings-prompts.tsx`  
  - 三模式 tab：Boss / 投手 / 創意  
  - 已發布區：模式名稱、發布時間、發布者（目前為「—」）、主 prompt 摘要（前 3 行）  
  - Draft 區：註明「此區只編輯主 prompt，不包含 Hidden Calibration」  
  - Hidden Calibration 區：唯讀，僅顯示已啟用校準模組名稱  
- **側欄**：`app-sidebar.tsx` 與 `tasks.tsx` 文案改為「RICH BEAR 審判官」

### 4.3 Schema

- `shared/schema.ts`：`contentJudgmentChatRequestSchema` 新增可選 `uiMode: z.enum(["boss","buyer","creative"])`

---

## 五、驗收對照

| 項目 | 狀態 |
|------|------|
| Base Core 仍為原文口吻與力度，未被平庸化 | ✅ 僅加區塊標題，字句與 storage 一致 |
| 原本四模式（A/B/C/D）未消失 | ✅ 保留於 `rich-bear-persona.ts` 並參與組裝 |
| UI 三模式、系統內四模式執行層並存 | ✅ `UI_MODE_TO_INTERNAL` 對應表如上 |
| Hidden Calibration 與 Draft 分離 | ✅ 設定頁獨立「Hidden Calibration 已啟用」唯讀區 |
| RICH BEAR 審判官命名與品牌化 | ✅ 主標、副標、側欄、任務頁已更新 |
| 交付報告列出保留原文／結構整理／calibration slice／三對四對應 | ✅ 見本文件第二、三節 |

---

*文件版本：人格保真重構完成日。*
