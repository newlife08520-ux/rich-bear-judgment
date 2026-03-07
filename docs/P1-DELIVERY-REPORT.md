# P1 交付報告

## 1) 完成狀態

| 項目 | 狀態 | 說明 |
|------|------|------|
| **P1-1 Judgment 決策卡內容全面落地** | ✅ 完成 | 8 張卡由規則引擎產出，無 placeholder；每卡含結論／觸發規則／證據指標／建議動作／影響金額／置信度；API `GET /api/workbench/decision-cards`，Judgment 頁接 API 顯示。 |
| **P1-2 Owner / 任務 / 狀態持久化（DB + audit log）** | ✅ 完成 | 存檔於 `.data/workbench-owners.json`、`workbench-tasks.json`、`workbench-audit.json`；API GET/PATCH owners、GET/POST/PATCH tasks、GET audit；商品頁 owner/任務狀態改為呼叫 API，變更寫入 audit。 |
| **P1-3 Filter Bar 補齊「商品」「負責人」多選 UI** | ✅ 完成 | FilterBar 新增商品多選、負責人多選（Popover + Checkbox）；商品頁依 productIds、ownerIds 篩選；Saved Views 切換會過濾/排序，可見差異。 |
| **P1-4 任務中心最小可用** | ✅ 完成 | 首頁「待分配任務」改為 API 計數（unassigned + assigned）；新增任務中心頁 `/tasks`（列表、建立、指派、狀態、備註）；商品作戰室每列「生成任務」一鍵帶入商品/建議/理由並 POST 建立任務。 |
| **P1-5 商品映射最小修正機制** | ✅ 完成 | 未映射清單（API + 頁面）、手動覆蓋（PUT override 存檔）、衝突顯示（同一素材對多商品）；頁面 `/mapping`。 |

---

## 2) 已完成項目

### 頁面

- **Judgment**：決策卡改為呼叫 `GET /api/workbench/decision-cards`，8 張卡顯示結論、觸發規則、證據指標、建議動作、影響金額、置信度；可複製執行清單有複製鈕。
- **商品作戰室**：Owner/任務改為 API（GET/PATCH workbench/owners）；FilterBar 含商品/負責人多選；每列「生成任務」開 modal 帶入後 POST 建立任務。
- **今日決策中心**：待分配任務數字改為 `workbench/tasks` 的 unassigned+assigned 筆數，並連結「前往任務中心」。
- **任務中心** `/tasks`：任務列表、建立表單、指派/狀態/備註編輯（PATCH）。
- **商品映射** `/mapping`：未映射清單（Campaign 名稱 + 指定商品 + 覆蓋儲存）、衝突清單（同一素材對多商品）。

### 元件

- **FilterBar**：商品多選、負責人多選（Popover + Checkbox），與 filter state、Saved Views 連動。
- **決策卡區**（Judgment）：依 API 回傳的 8 張卡結構渲染，含置信度與可複製清單。

### 規則／資料來源

- **決策卡**：`shared/decision-cards-engine.ts` 依 productLevel、creativeLeaderboard、funnelWarnings、urgentStop、failureRatesByTag 產出 8 張卡；結論/規則/證據/動作/影響/置信度皆由規則引擎產出，無 AI 結論。
- **Owner / 任務 / 審計**：`server/storage.ts` 以 JSON 檔持久化；API 寫入時寫一筆 audit（userId, entityType, entityId, action, oldValue, newValue, at）。
- **商品映射**：未映射 = 無 parse 且無 override 的 campaign；衝突 = 同 (materialStrategy, headlineSnippet) 對應多個 productName；手動覆蓋 = PUT 寫入 `workbench-mapping.json`。

### 資料來源標註

| 資料 | 來源 |
|------|------|
| 決策卡 8 張內容 | **規則引擎**（後端 buildDecisionCards，無 placeholder） |
| 商品 / 投手 / 素材 owner、任務狀態 | **API 持久化**（.data JSON，跨裝置一致） |
| 任務列表、待分配任務數 | **API** GET workbench/tasks |
| 未映射 / 衝突 / 商品名單 | **API** GET workbench/mapping/context（依 batch + overrides 計算） |
| 手動覆蓋對應 | **API** PUT workbench/mapping/override，存檔 |

---

## 3) 未完成項目與原因

- **無**。本輪 P1-1～P1-5 均依規格實作並可驗收。

---

## 4) 驗收步驟

### P1-1 Judgment 決策卡

1. 登入後進入 **AI 判讀中心** `/judgment`。
2. 確認上方「AI 決策卡（規則引擎產出）」區有 **8 張卡**：今日總結、立即處理 3–5 件事、商品判決、素材判決、預算建議、owner 建議、不確定因素、可複製執行清單。
3. 每張卡應有：**結論**、**觸發規則**、**證據指標**、**建議動作**、**影響金額**、**置信度**（高/中/低/資料不足）；**不得**出現「— 從對話取得」或空白 placeholder。
4. 若有同步廣告資料，今日總結應有商品數/花費/停損與加碼數等；立即處理應有具體條目；可複製執行清單有複製鈕，點擊可複製到剪貼簿。
5. 若無廣告資料，卡片仍會產出內容（例如「目前無商品維度資料」），**不得**為空白或「— 從對話取得」。

### P1-2 Owner / 任務持久化

1. 進入 **商品作戰室** `/products`，任選一商品設定「商品 owner / 投手 owner / 素材 owner」或「指派狀態」。
2. 重新整理頁面或換裝置再開同一帳號，確認剛設定的 owner/狀態仍存在（**非** localStorage，為後端存檔）。
3. 側欄進入 **任務中心** `/tasks`，建立一筆任務、指派負責人、改狀態、填備註；重新整理後資料仍在。
4. （可選）後端 `.data/workbench-owners.json`、`workbench-tasks.json`、`workbench-audit.json` 有對應寫入；`workbench-audit.json` 有變更紀錄（誰、何時、改什麼）。

### P1-3 Filter Bar 多選 + Saved Views

1. 進入 **商品作戰室**，確認 Filter Bar 有 **商品**、**負責人** 兩個多選按鈕（顯示「商品」「負責人」或「商品 (n)」「負責人 (n）」）。
2. 點「商品」→ 勾選/取消多個商品，列表應即時篩選為僅這些商品。
3. 點「負責人」→ 勾選多個負責人，列表應僅顯示「該商品三種 owner 任一等於所選負責人」的列。
4. 切換 **Saved View**（例：低 ROAS 停損、高潛力加碼）：列表內容與排序應明顯變化，**不是**只換標籤。

### P1-4 任務中心

1. **首頁**：在「警報與任務」卡中，「待分配任務」應為一數字（≥0），且若 >0 有「前往任務中心」連結；點擊進入 `/tasks`。
2. **任務中心**：可建立任務（標題、建議動作、理由、選填商品）；列表可改指派、狀態、備註；備註改完 onBlur 會儲存。
3. **商品作戰室**：任一行點「生成任務」→ 彈窗帶入該商品與 AI 建議/規則 → 點「建立任務」→ 任務中心應多一筆，且可指派/改狀態/備註。

### P1-5 商品映射

1. 進入 **商品映射** `/mapping`（側欄「商品映射」）。
2. **未映射清單**：若有未符合命名規則的 campaign，應列出 Campaign 名稱；可選「指定商品」並點「覆蓋儲存」；重新整理後該筆應自未映射清單消失（或該 campaign 已對應到所選商品）。
3. **映射衝突**：若有同一素材（相同 materialStrategy + headlineSnippet）出現在多個商品下，應列出「創意 key → 商品 A、B、…」並可連結至商品作戰室處理。

### 驗收標準對照

- **Judgment 8 張卡不得有 placeholder**：✅ 已由規則引擎產出，無「— 從對話取得」。
- **任務與 owner 不得只存 localStorage**：✅ 皆為後端 `.data` JSON + API。
- **FilterBar 多選 + SavedViews 必須可用**：✅ 商品/負責人多選可篩選；Saved View 切換會過濾/排序。
- **投手模式可輸出可執行清單**：✅ 決策卡「可複製執行清單」可複製；商品作戰室可「生成任務」帶出商品/素材/動作/理由。

---

## 5) 後端 Gap List

| 類型 | 說明 |
|------|------|
| **持久化** | 目前為檔案 JSON（.data）；若未來要多人/權限/備援，可改為正式 DB（如 PostgreSQL）並遷移 schema。 |
| **商品維度欄位** | CTR/CVR/CPC/CPA、素材數/勝出/疲勞仍為前端或既有 API 推導；若後端要單一來源，可再補欄位或 API。 |
| **映射與彙總** | 手動覆蓋已存檔，但 **action-center / productLevel 尚未使用 override**；若要以覆蓋結果重新彙總商品維度，需在 action-center 或 aggregate 時讀取 overrides 並以「override 優先於 parse」。 |
| **任務與 owner 關聯** | 任務的 assignee 目前為「員工 id」（前端 Employee 情境）；若與登入帳號整合，需使用者/員工對應與權限。 |

---

## 6) 自我檢查

- **Product-first**：商品作戰室以商品為主體，決策卡有「商品判決」與「預算建議」以商品為單位；商品映射以 campaign→商品 對齊。 ✅  
- **Action-first**：決策卡「立即處理 3–5 件事」「可複製執行清單」；任務中心與一鍵生成任務讓建議可轉成可指派、可追蹤的任務。 ✅  
- **Owner-first**：商品三種 owner、任務指派、Filter 依負責人篩選；任務中心可指派與改狀態。 ✅  
- **投手每日可執行**：決策卡無 placeholder、可複製清單；任務中心待分配為真資料；商品頁可一鍵生成任務並在任務中心處理。 ✅  

**下一輪建議**

- action-center / aggregate 使用 mapping overrides，使「手動覆蓋」真正影響商品維度彙總。
- 任務與「員工/帳號」整合（若有多人登入）。
- 決策卡若需 AI 補原因與語氣，可保留規則引擎結論，僅用 AI 擴充說明，不憑空產生結論。
