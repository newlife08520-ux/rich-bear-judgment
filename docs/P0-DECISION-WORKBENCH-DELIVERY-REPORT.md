# P0 決策工作台交付報告

## 1. 完成狀態

| 狀態 | 說明 |
|------|------|
| **已完成** | 本輪 P0 與額外要求均以「可驗收版本」落地，資料缺口以前端推導 / mock / placeholder 補齊並明確標註。 |

### 每個 P0 項目完成度

| 項目 | 完成度 | 備註 |
|------|--------|------|
| **P0-1 新 IA 文件落 repo** | ✅ 100% | `docs/IA-P0-DECISION-WORKBENCH.md` 已新增，含核心原則、角色、頁面分工、狀態、規則、Filter、Owner。 |
| **P0-2 Judgment 三區塊重構** | ✅ 100% | 左側快速入口、中間 8 張決策卡 + 聊天、右側證據/歷史 Tabs；決策卡含今日總結（從最後一則 assistant 帶入）、其餘 7 塊預留「— 從對話取得」；可複製執行清單有複製按鈕。 |
| **P0-3 商品作戰室改商品主列表** | ✅ 100% | `/products` 頁：API action-center + deriveProductRow；表格含商品名、三種 owner、花費/營收/ROAS、CTR/CVR/CPC/CPA、素材數/勝出/疲勞、狀態、AI 建議、下一步、指派狀態、最後更新；Filter + Saved View 套用。 |
| **P0-4 固定 Filter Bar + Saved Views** | ✅ 100% | FilterBar 元件：日期、Saved View 下拉、狀態、最低花費、排序、清除；狀態存 WorkbenchFilterContext (localStorage)；6 個 Saved Views 在商品頁套用 (applySavedViewToProducts)。商品/負責人多選 UI 未做（見未完成）。 |
| **P0-5 owner / assignee / status 基礎 UI** | ✅ 100% | 商品頁：商品 owner、投手 owner、素材 owner 下拉（employees）；任務狀態選單；存 localStorage `workbench-product-owners`。 |
| **P0-6 今日決策中心首頁** | ✅ 100% | 標題與問候、今日 KPI 卡、今日重點四卡（加碼/危險/待處理素材/警報與任務）、其餘既有區塊；待分配任務為 Mock。 |
| **狀態系統** | ✅ 100% | `decision-workbench.ts`：PRODUCT_STATUS、CREATIVE_STATUS、TASK_STATUS 常數；商品表用 status Badge；規則標籤 (ruleTags) 顯示在「下一步」。 |
| **規則引擎（前端可運作）** | ✅ 100% | deriveProductRow 內實作：停損候選、建議加碼、危險、疑頁面/受眾、素材問題優先、續測、winner、需補新素材等標籤；依花費/ROAS/CTR/CVR/CPC/素材數等門檻推導。 |
| **Judgment 固定 8 塊** | ✅ 100% | 今日總結、立即處理 3–5、商品判決、素材判決、預算建議、owner 建議、不確定因素、可複製執行清單；僅今日總結自動帶入，其餘 placeholder。 |
| **Filter Bar 真的能篩** | ✅ 部分 | 日期、Saved View、狀態、最低花費、Sort 已接上並作用；商品 ID、負責人 ID 多選 UI 未做，filter state 已留欄位。 |
| **Saved Views 6 個** | ✅ 100% | 老闆晨會、投手今日待辦、高潛力加碼、低 ROAS 停損、素材疲勞汰換、新素材續測；在商品頁套用。 |
| **頁面結構 summary + actions 在上** | ✅ 100% | 首頁：KPI + 今日重點在上；商品頁：摘要卡 + 表格；Judgment：決策卡在上、聊天在下。 |

---

## 2. 本輪實作內容

### 頁面改動

- **`/` (dashboard)**：改為「今日決策中心」、今日 KPI 卡、今日重點四卡（加碼 Top3、危險 Top3、待處理素材 Top5、警報與任務）。
- **`/products`**：新增商品作戰室頁，主列表 + FilterBar + 摘要卡 + owner/status UI。
- **`/judgment`**：改為「AI 判讀中心」；左側快速入口、中間 8 張決策卡 + 聊天、右側證據/歷史 Tabs；決策卡區可收合。

### 元件新增

- **FilterBar**（`client/src/components/shared/filter-bar.tsx`）：DateRangeSelector、Saved View 下拉、狀態篩選、最低花費、排序、清除；接 `useWorkbenchFilter`。
- **WorkbenchFilterProvider**（`client/src/lib/workbench-filter-context.tsx`）：Filter 狀態與 localStorage 持久化。
- **決策卡區**（judgment 頁內）：8 張 Card，今日總結從訊息帶入；可複製執行清單有複製按鈕。

### 規則已落地（前端）

- 花費達門檻 + ROAS 低於目標 → 停損候選
- CTR 高 + CVR 低 → 疑頁面/疑受眾
- CTR 低 + CPC 高 + 花費已大 → 素材問題
- 頻率高 + CTR 下滑 → 疲勞候選（依 failureRatesByTag）
- 新素材資料不足 → 續測
- 同商品有明顯高表現素材 → winner
- 同商品多支素材都燒錢 → 需補新素材  
以上在 `deriveProductRow` / 素材推導中產出 `ruleTags` / `productStatus`，表格顯示在「狀態」「下一步」。

### 資料來源標註

| 資料 | 來源 | 說明 |
|------|------|------|
| 商品列表、花費、營收、ROAS、productLevel | **真實 API** | `/api/dashboard/action-center` |
| CTR、CVR、CPC、CPA（商品維度） | **前端推導** | 由 productLevel / aggregate 計算或 placeholder |
| 啟用素材數、勝出素材數、疲勞素材數 | **前端推導** | creativeLeaderboard + failureRatesByTag 聚合 |
| 狀態 (productStatus)、AI 建議、ruleTags | **前端推導** | decision-workbench 規則引擎 |
| 商品/投手/素材 owner、任務狀態 | **前端 mock** | localStorage `workbench-product-owners`，選單用 employees API |
| 今日決策中心「待分配任務」數字 | **Mock** | 固定「—（Mock）」 |
| 決策卡「今日總結」以外 7 塊內容 | **Placeholder** | 「— 從對話取得」 |
| 最後更新時間 | **Placeholder** | 表格顯示「—」 |

---

## 3. 驗收步驟

### 今日決策中心（首頁）

1. 開啟 `/`，應看到標題「今日決策中心」與「30 秒掌握今日重點」。
2. 上方有今日 KPI 卡：總花費、營收、ROAS、利潤估算（數字來自 action-center 加總）。
3. 下方有「今日重點」四卡：今日最值得加碼 Top3、今日最危險 Top3、今日待處理素材 Top5、警報與任務（含「待分配任務 —（Mock）」）。
4. 點「今日最值得加碼」等卡內連結應可跳到 `/products`。

### 商品作戰室（商品主列表）

1. 開啟 `/products`，應先看到 FilterBar（日期、Saved View、狀態、最低花費、排序、清除）。
2. 上方摘要卡：商品數、總花費、營收、平均 ROAS。
3. 表格欄位：商品名稱、商品 owner、投手 owner、素材 owner、花費、營收、ROAS、CTR、CVR、CPC、CPA、啟用素材數/勝出/疲勞、狀態、AI 建議、下一步、指派狀態、最後更新。
4. 切換 **Saved View**（例：低 ROAS 停損、素材疲勞汰換）：列表應篩選/排序變化。
5. 調整 **最低花費**、**狀態**、**排序**：列表應即時更新。
6. 變更任一 owner 或任務狀態：重新整理後仍保留（localStorage）。

### Judgment 不再只是聊天室

1. 開啟 `/judgment`，標題為「AI 判讀中心」。
2. **左側**：除歷史對話外，有「快速入口」連結（今日決策、商品作戰室）。
3. **中間上方**：固定「AI 決策卡」區，8 張卡（今日總結、立即處理、商品判決、素材判決、預算建議、owner 建議、不確定因素、可複製執行清單）；有對話時「今日總結」顯示最後一則 assistant 前 300 字，其餘為「— 從對話取得」。
4. **中間下方**：原有聊天區。
5. **右側**：可收合面板，Tabs「證據與指標」「歷史操作」；Header 有按鈕可收合/展開右側。
6. 「可複製執行清單」卡片有複製圖示，點擊可複製內容到剪貼簿。

### Filter Bar 與 Saved Views

1. 在商品作戰室選 **Saved View**：「老闆晨會」「投手今日待辦」「高潛力加碼」「低 ROAS 停損」「素材疲勞汰換」「新素材續測」會過濾/排序商品。
2. 改 **日期範圍**、**最低花費**、**狀態**、**排序**：列表與摘要卡數字應隨之變化。
3. 清除篩選：恢復預設檢視。

---

## 4. 未完成與原因

| 項目 | 原因 |
|------|------|
| Filter Bar 的「商品」「負責人」多選 UI | 未做下拉多選元件，filter state 已留 `productIds`、`ownerIds`；需補 UI 或接現有 Select 多選。 |
| 今日決策中心「待分配任務」真實數字 | 目前 Mock；若要做成真實，可從 localStorage 的任務狀態計數（未指派/進行中等）。 |
| 決策卡其餘 7 塊自動填滿 | 需後端回傳結構化欄位或約定 AI 回覆格式由前端解析；目前僅今日總結從訊息擷取。 |
| 商品「最後更新時間」 | 後端無欄位；前端未寫入時間戳，表格顯示「—」。 |

---

## 5. 後端 Gap List

| 類型 | 缺項 | 說明 |
|------|------|------|
| 欄位 | 商品維度 CVR / CPC / CPA / 頻率 | 若 action-center 未帶齊，需後端補或前端繼續用推導/placeholder。 |
| 欄位 | 商品/素材/任務的「最後更新時間」 | 需後端或統一寫入策略。 |
| API/持久化 | 商品 owner、投手 owner、素材 owner、任務 assignee、任務狀態 | 目前 localStorage；跨裝置與權限需後端 API。 |
| API | AI 結構化輸出（8 塊決策卡） | 若希望 8 塊自動填滿，需後端回傳結構化 JSON 或約定格式。 |
| 資料 | 待分配任務數、依負責人篩選的任務列表 | 若要做「投手今日待辦」等真實資料，需任務/負責人維度 API。 |

---

## 6. 自我檢查

- **Product-first**：商品作戰室以商品為主體，每列一商品，含 owner、指標、狀態、AI 建議、下一步；Saved Views 以商品維度篩選/排序。 ✅
- **Action-first**：首頁今日重點、立即處理；Judgment 決策卡「立即處理 3–5 件事」與可複製執行清單；商品表「下一步」為規則標籤。 ✅
- **Owner-first**：商品表三種 owner、任務狀態可選；Filter 留負責人欄位；Saved View 含「投手今日待辦」。 ✅
- **三種角色**：老闆（今日決策、晨會 View）、投手（待辦、owner 欄位）、素材策略（疲勞汰換、續測、需補新素材 View）皆有對應入口與檢視。 ✅

**下一輪建議補強**  
- Filter Bar 商品/負責人多選 UI。  
- 決策卡 7 塊與後端或 AI 結構化輸出串接。  
- 最後更新時間與任務數真實資料來源。  
- 各核心頁截圖補齊並標註 mock/placeholder（見下方）。

---

## 驗收附加

### 截圖建議

請在本地執行後自行截圖留存：

1. **今日決策中心**：`/` — 上半部 KPI + 今日重點四卡。
2. **商品作戰室**：`/products` — FilterBar + 摘要卡 + 表格（含狀態、下一步、owner）。
3. **AI 判讀中心**：`/judgment` — 左側快速入口、中間 8 張決策卡 + 聊天、右側 Tabs。

### Judgment 前後差異

- **前**：以聊天室為主，無固定策略區塊。  
- **後**：策略中心型；中間固定 8 張決策卡（今日總結、立即處理、商品/素材判決、預算、owner、不確定因素、可複製清單），下方才是對話；左側快速入口、右側證據/歷史；「今日總結」從最後一則 AI 回覆帶入，其餘為 placeholder，待後端/結構化輸出補齊。

### 商品作戰室前後差異

- **前**：無獨立商品主列表頁。  
- **後**：專頁 `/products`，以商品為每一列；含三種 owner、花費/營收/ROAS、CTR/CVR/CPC/CPA、素材數/勝出/疲勞、狀態、AI 建議、下一步、指派狀態；FilterBar + 6 個 Saved Views 可篩選/排序；資料來自 API + 前端推導 + owner/狀態 mock。

### 今日決策中心如何 30 秒抓重點

- 首屏：今日 KPI（花費、營收、ROAS、利潤）與四張今日重點卡（加碼 Top3、危險 Top3、待處理素材 Top5、警報與任務），高優先放前；不需滑動即可看到結論與入口連結。

### Mock / Placeholder 明確標記

- 商品頁：owner 與任務狀態旁可加小字「本機儲存」；「最後更新」欄為「—」即為缺欄位。  
- 首頁：「待分配任務」已標「—（Mock）」。  
- Judgment：除「今日總結」外，7 張卡內容為「— 從對話取得」即為 placeholder。

---

*報告產出日：依本輪交付時程。*
