# RICH BEAR 審判官 — 產品整理／命名統一／流程引導 需求審查與規格對照

本文件為**完整 review/spec-check**，不實作程式。目標：把現有功能整理成「真的好用、看得懂、可管理」的系統，不做新功能堆疊。

---

## 一、命名與品牌統一

### 1.1 判讀中心改名

| 需求 | 現狀 | 位置 | 備註 |
|------|------|------|------|
| 側欄「AI 判讀中心」→ **RICH BEAR 審判官** | 側欄為「AI 判讀中心」 | `client/src/components/app-sidebar.tsx` L46 | 單一處，改 title 即可 |
| 判讀頁主標：**RICH BEAR 審判官** | 頁首為「AI 判讀中心」 | `client/src/pages/judgment.tsx` L447 | 需改為主標＋副標結構 |
| 副標：**王牌爆款陪跑行銷總監｜判讀素材、頁面、廣告與漏斗** | 無副標 | 同上 | 新增副標元素 |
| 空狀態品牌化：今日可審判 + 四入口 + 「拿判決」不是「純聊天」 | 空狀態為「輸入你的問題或貼上素材說明」+ 範例，偏聊天殼 | `judgment.tsx` L602-607 | 需改為四入口（素材/商品頁/廣告數據/GA4 漏斗）＋說明「拿判決」 |

**全站文案掃描結果（建議一併替換）：**

- `app-sidebar.tsx`：應用標題為「AI 行銷總監」→ 若品牌統一為 RICH BEAR 審判官，可改為「RICH BEAR 審判官」或保留「AI 行銷總監」當產品副名，需產品決策。
- `judgment.tsx`：AI 判讀中心、決策卡區「AI 決策卡」。
- `tasks.tsx` L183：「AI 判讀中心一鍵生成」→「RICH BEAR 審判官一鍵生成」。
- `history.tsx`：審判報告、審判類型（素材/銷售頁/FB/GA4）可保留「審判」用詞。
- `settings.tsx`：正式審判模型、調整 AI 審判、控制 AI 審判 → 改為「審判官判讀」或「RICH BEAR 審判官」。
- `storage.ts` / `ai-summary-pipeline.ts` / `prompt-builder.ts`：內建文案「AI 行銷審判官」→ 可改為「RICH BEAR 審判官」或保留系統人格名。
- `server/routes.ts`：錯誤訊息「請提供審判內容」等可保留「審判」。

**規格結論：**  
- 側欄、判讀頁主/副標、空狀態四入口與「拿判決」說明為必改。  
- 全站「AI 判讀」「審判」建議統一為「RICH BEAR 審判官」或「審判官判讀」，並列清單一次替換。

---

### 1.2 文案統一原則

- 對外/UI：**RICH BEAR 審判官** 或 **審判官判讀**。  
- 避免混用：AI 判讀中心、AI 審判、AI 行銷總監（若不再當主品牌）。  
- 需產品決定：sidebar 頂部「AI 行銷總監」是否改為「RICH BEAR 審判官」。

---

## 二、Prompt 架構重整

### 2.1 現狀與斷層

| 層級 | 現狀 | 位置 |
|------|------|------|
| **Judgment 聊天用 system prompt** | 來自 `storage.getSettings(userId)`：`systemPrompt \|\| coreMasterPrompt`，**未使用** workbench PromptVersion | `server/routes.ts` L520-521（content-judgment/chat） |
| **正式審判報告用 prompt** | `buildFinalSystemPrompt(settings, taskType)` 使用 UserSettings 的 `coreMasterPrompt` + `modeXPrompt`（A/B/C/D），來自 storage 預設 | `server/prompt-builder.ts`；storage 預設在 `server/storage.ts` L398-402 |
| **Workbench Prompt 設定頁** | Boss / 投手 / 創意 三模式，Draft / Publish / Rollback，**僅存 DB，未接到判讀 API** | `client/src/pages/settings-prompts.tsx`；`server/workbench-db.ts` getPublishedPrompt(mode) |

**結論：**  
- 目前判讀行為由 **storage 的 coreMasterPrompt + mode A/B/C/D** 驅動，與設定頁的 **Boss/投手/創意** 完全脫鉤。  
- 需求之「可編輯主 prompt（Boss/投手/創意）」= 現有 workbench 三模式，但必須接到判讀流程（chat + 若有 start 報告）並改為**依模式片段載入**。

### 2.2 雙層架構對照

| 需求 | 現狀 | 規格建議 |
|------|------|----------|
| **A. Visible Prompt Layer** | 設定頁已有 Boss/投手/創意、Draft/Publish/Rollback | 保留；補充「說明文」「模式差異」「已發布區塊」顯示：現行模式名、最後發布時間、發布者、前 3 行摘要 |
| **B. Hidden Calibration Layer** | 無；目前是一整段 core + mode 全文 | 新增：系統內建 calibration 文案，不進同一編輯框；可由超管查看摘要；執行時依**模式**片段組裝 |
| **讀取策略** | 判讀 chat 用整段 systemPrompt；報告用 core+mode 兩段拼接 | 改為：依「當前模式」只載入該模式主 prompt 片段 + 該模式 calibration 片段，**不要**每次送兩份全文 |
| **設定頁優化** | 已發布只顯示 `<pre>` 全文；Draft 無說明 | 已發布：模式名、最後發布時間、發布者、前 3 行摘要；Draft 區塊加說明「可發布主 prompt，不包含系統隱性校準」+ 模式差異（Boss/投手/創意）；新增「隱性校準已啟用」只讀提示（不暴露全文） |

### 2.3 技術對接要點

1. **判讀 API 改用 workbench prompt**  
   - `content-judgment/chat`（與 `/start` 若有）：改為依「模式」參數（boss/buyer/creative）呼叫 `getPublishedPrompt(mode)`，再與 calibration 片段組裝，**不再**用 `storage.getSettings().systemPrompt/coreMasterPrompt` 當主 prompt。  
2. **模式對應**  
   - 創意模式 → 素材審判；投手模式 → 廣告/ROI/漏斗決策；Boss 模式 → 決策摘要/商業判斷。  
   - 需決定：judgment 頁是否讓使用者選「當前模式」，或依審判類型（creative/fb_ads/ga4_funnel）自動對應 mode。  
3. **Calibration 實作**  
   - 新增常數或小檔（如 `server/prompt-calibration.ts`），依 mode 回傳片段；不寫入 DB，不給一般使用者在設定頁編輯。  
4. **Token/延遲**  
   - 組裝時只送「該模式主 prompt + 該模式 calibration」，避免重複送兩份全文。

---

## 三、各頁面 UX / 流程優化 對照

### 3.1 RICH BEAR 審判官頁（judgment.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| 深色風格像「品牌主場」 | 已深色（slate），偏中性 | 可加品牌色/logo 區塊，不一定要改淺色 |
| 左側：常用審判模式、最近模板、快速上傳、快速跳轉（商品作戰室/今日決策/素材生命週期） | 左側：搜尋歷史、快速入口（今日決策、商品作戰室） | 新增：常用審判模式、最近使用模板、快速上傳素材、快速跳轉三連結 |
| 中間空狀態：四入口（素材/商品頁/廣告數據/GA4 漏斗） | 空狀態：一句話 + 範例 | 改為四張大入口卡＋「拿判決」說明 |
| 右側證據區顯示資料來源 | 右側為「證據與指標」「歷史操作」，證據為本次上傳＋AccountExceptionsBlock | 在證據區標註來源：Meta、GA4、ROI 漏斗規則引擎、任務中心/歷史操作 |

**檔案：** `client/src/pages/judgment.tsx`（約 760 行）。

---

### 3.2 門檻設定（settings-thresholds.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| 每個欄位一行說明 | 僅 label，無說明 | 每個欄位下或旁加一行說明（可 `<p className="text-xs text-muted-foreground">`） |
| 「影響頁面」區塊 | 無 | 新增一 Card：列出「素材生命週期、成功率成績單、汰換建議、RICH BEAR 審判官決策卡」 |
| 已發布區塊：版本資訊與摘要 | 僅數值列表＋回滾鈕 | 顯示版本資訊（若 API 有提供）、簡短摘要（例如哪些門檻已自訂） |
| 極端值風險提示 | 無 | 若 minSpend 等低於某閾值，顯示提示（例如「minSpend 過低易造成 Lucky 誤判」） |

**欄位說明與影響頁面**可寫死在 UI 常數（不一定要新 API）。

---

### 3.3 團隊權限（team-settings.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| Coverage 從紅條升級成三張管理卡 | 單一 Alert「Coverage 提醒」列點（缺 primary/缺 backup/超載） | 改為三張 Card：① 缺 primary owner 的在投商品 ② 缺 backup owner 的在投商品 ③ 主責超載的人 |
| 每張卡：數量、前 3 筆例子、立即處理按鈕 | 目前僅文字敘述 | 每卡：數字、前 3 筆範例、按鈕（可導向該員工編輯或篩選） |
| Transfer List 補強：只看已選、全選目前篩選、搜尋結果數量、儲存前 diff 更清楚 | 有雙欄、搜尋、diff 為 Dialog 顯示「儲存前/儲存後」帳號與商品數量 | 新增：篩選「只看已選」、全選目前篩選結果、顯示搜尋結果數量；diff 區分「新增/移除」列表，不只數字 |

**API：** `/api/workbench/coverage-check` 已回傳 `missingPrimary`、`missingBackup`、`overload`，前端改版即可。

---

### 3.4 素材生命週期（creative-lifecycle.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| 空狀態改為指引 | 有「尚無素材或篩選無結果」 | 改為：尚無素材或尚未達門檻；前往素材中心上傳、前往投放中心建立草稿、前往同步資料（連結＋按鈕） |
| 每張卡明確小 badge | 已有 LabelBadge（Winner/Underfunded/Lucky 等） | 確認七種都顯示：Winner, Underfunded, Lucky, NeedsMoreData, Stable, FunnelWeak, Retired（與 API label 一致） |
| 頁首簡短說明 | 僅「素材清單（ROI 漏斗，依 priority 排序）」 | 加一句：「此頁依 ROI + Funnel Health + Confidence 判斷」 |

**現有 API** 已回傳 `label`，前端已有 filter；僅需補空狀態指引與頁首說明。

---

### 3.5 成功率成績單（scorecard.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| KPI 說明列 | 有 launchedCount、successRate、luckyRate、funnelPassRate、avgQualityScore，無說明 | 在表上方或每張卡上方加一行說明：成功率 = Winner/本月上線；Lucky rate = Lucky/本月上線；Funnel pass rate = 漏斗健康達標占比；Avg quality score = ROI+漏斗+置信度綜合分數 |
| 區分 Buyer / Creative，標題與說明更清楚 | 已有「依買手」「依素材負責人」兩張表 | 標題改為「Buyer 成績」「Creative 成績」＋一句說明，避免誤解 |

---

### 3.6 任務中心（tasks.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| 任務來源、優先級、截止日、影響金額、對應商品/素材、任務類型 | WorkbenchTask 型別無 source、priority、dueDate、impactAmount、creativeId 等 | **需擴充 schema**：taskSource（審判官/lifecycle/replacement/手動）、priority、dueDate、impactAmount、productName 已有；creativeId 已有；taskType 可選 |
| 批次改狀態、批次指派、只看我負責 | 僅單筆編輯、無批次、無「我的任務」篩選 | 新增：多選＋批次改狀態、批次指派；篩選「只看我負責」（依 assigneeId 或當前 user） |

**後端：** WorkbenchTask 在 `shared/workbench-types.ts` 與 Prisma/DB 需加欄位；`PATCH /api/workbench/tasks/batch` 或類似批次 API。

---

### 3.7 投放中心（publish-placeholder.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| 改為多步驟 wizard | 目前為長表單/modal | Step1 基本設定（帳號/目標/campaign/adset/ad/預算）；Step2 素材與版本（選素材包、版本、尺寸類型）；Step3 投放前檢查（CTA、粉專/IG、落地頁、檢查結果） |
| 保留投放前檢查邏輯 | 需確認現有檢查在哪 | 保留既有檢查，放入 Step3 |

**檔案較大（約 1479 行），建議拆成 steps 元件或 state machine，不一次重寫。**

---

### 3.8 GA4 頁面分析（ga4-analysis.tsx）

| 需求 | 現狀 | 規格 |
|------|------|------|
| 空狀態改為 onboarding | 需確認目前空狀態文案 | 改為：確認已串接 Property → 點右上更新資料 → 若仍無資料，前往設定中心檢查 GA4 連線（步驟化＋連結） |

---

## 四、角色流程導覽

| 需求 | 現狀 | 規格 |
|------|------|------|
| 首頁或設定中心新增「角色工作流」 | 首頁為今日決策中心（dashboard），無角色導覽 | 在**設定中心**或**首頁**新增一區塊「角色工作流」：三張卡（老闆/投手/素材），每張列出「每天看」的 4 個頁面＋連結 |

建議放在設定中心較不干擾首頁；若首頁有空間可放精簡版。

---

## 五、交付要求與驗收標準 對照

### 5.1 回報格式（需求已定）

- 完成狀態  
- 已完成項目  
- 各頁優化摘要  
- Prompt 架構調整說明  
- 驗收步驟  
- 未完成與原因  
- 下一步建議  

（實作完成後再填此回報。）

### 5.2 截圖需求（共 9 頁）

- RICH BEAR 審判官  
- Prompt 設定  
- 門檻設定  
- 團隊權限  
- 素材生命週期  
- 成功率成績單  
- 任務中心  
- 投放中心  
- GA4 頁面分析  

（實作與 UI 調整完成後擷圖附在回報中。）

### 5.3 驗收標準（需求已定）

1. 使用者第一次看頁面能知道這頁在做什麼  
2. 判讀中心已品牌化為 RICH BEAR 審判官  
3. Prompt 架構清楚區分主 prompt 與 hidden calibration  
4. 門檻設定不再像純工程後台  
5. 團隊權限的 coverage 問題更可讀、更可處理  
6. 素材生命週期的分類更容易理解  
7. 任務中心更像工作台而不是單純表格  
8. 投放中心流程壓力更低  
9. GA4 空狀態有明確指引  

---

## 六、實作順序建議（不新增功能為前提）

1. **命名與品牌**  
   - 側欄、判讀頁主/副標、空狀態四入口＋「拿判決」；全站文案清單替換。  
2. **Prompt 架構**  
   - 後端：判讀 API 改為依 mode 讀取 workbench published prompt ＋ calibration 片段組裝；新增 calibration 層。  
   - 設定頁：已發布摘要、Draft 說明、隱性校準已啟用提示。  
3. **各頁 UX（依依賴從少到多）**  
   - 門檻設定：說明＋影響頁面＋風險提示（純前端）。  
   - 素材生命週期：空狀態指引＋頁首說明（純前端）。  
   - 成功率成績單：KPI 說明＋Buyer/Creative 標題（純前端）。  
   - GA4：空狀態 onboarding（純前端）。  
   - 審判官頁：左側/右側/空狀態（前端為主）。  
   - 團隊權限：三張 coverage 卡＋Transfer List 補強（前端＋既有 API）。  
   - 任務中心：欄位擴充需 schema/API，批次與篩選可先做前端再對接。  
   - 投放中心：wizard 拆步（大改 UI，保留既有邏輯）。  
4. **角色工作流**  
   - 設定中心（或首頁）一區塊三張卡＋連結。  

---

## 七、風險與未決項

- **Prompt 雙軌**：目前 chat 用 storage 設定，報告用 storage 的 core+mode；若改為 workbench，需決定「未發布時」fallback（用 storage 或空白），以及是否遷移既有 storage 預設到 workbench 一版。  
- **任務中心 schema**：新增 taskSource、priority、dueDate、impactAmount、taskType 等需 DB migration 與 API 擴充。  
- **投放中心 wizard**：現有表單與 state 結構需重構，工作量大，建議單獨排期。  
- **截圖**：需在實作完成後於實際環境擷圖，無法在 spec-check 階段產出。

---

**文件狀態：** 需求審查與規格對照完成；實作與回報／截圖待下一階段執行。
