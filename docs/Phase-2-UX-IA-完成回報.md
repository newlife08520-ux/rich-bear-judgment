# Phase 2 完成回報 — UX / IA 整理（低風險、高可讀、高有感）

依 Phase 2 範圍：僅做「門檻說明、影響頁面、極端值提示、素材/成績單/GA4/審判官/團隊權限/角色工作流」之 UX／IA 整理，未碰任務 schema、未做投放 wizard、未擴充高風險 API。

---

## 1. 完成狀態

**Phase 2 已全部完成。**

- 門檻設定：欄位說明、影響頁面區塊、極端值風險提示已加上。
- 素材生命週期：頁首說明、空狀態引導（三按鈕）、七種 label/badge 一致化。
- 成功率成績單：KPI 說明列、Buyer／Creative 標題與說明已補齊。
- GA4 頁面分析：無資料時顯示 onboarding 步驟卡。
- RICH BEAR 審判官頁：左側（常用模式、最近使用模板、快速上傳、快速入口）與右側資料來源標示已在 Phase 1 完成，本輪僅將「最近模板」改為「最近使用模板」。
- 團隊權限：Coverage 改為三張管理卡；Transfer List 新增「只看已選」「全選目前篩選」、搜尋結果數量、儲存前 diff 區分新增/移除。
- 設定中心：新增「角色工作流」區塊，三張卡（老闆／投手／素材）各列 4 個核心頁面與連結。

---

## 2. 已完成項目

### 2.1 門檻設定（settings-thresholds.tsx）

- **每個欄位一行說明**：14 個欄位均加上 `description`，Draft 編輯區每列下方顯示說明（`text-xs text-muted-foreground`）。
- **「影響頁面」區塊**：新增 Card，列出「素材生命週期、成功率成績單、汰換建議與決策卡、RICH BEAR 審判官決策卡」。
- **極端值風險提示**：當 `minSpend < 200` 或 `minSpendForRules < 200` 時顯示一張琥珀色邊框 Card「極端值風險提示」，內文為兩條說明（Lucky 誤判、規則誤觸）。

### 2.2 素材生命週期（creative-lifecycle.tsx）

- **頁首說明**：副標「此頁依 ROI + Funnel Health + Confidence 判斷，標籤含 Winner、Underfunded、Lucky、NeedsMoreData、Stable、FunnelWeak、Retired。」。
- **空狀態引導**：無素材時改為有邊框與按鈕的區塊，文案「尚無素材或尚未達門檻」＋三按鈕：「前往素材中心上傳」「前往投放中心建立草稿」「前往設定中心同步資料」。
- **Badge／label 一致**：`LABEL_OPTIONS` 與 `LabelBadge` 對應七種（Winner、Underfunded、Lucky、NeedsMoreData、Stable、FunnelWeak、Retired），並以 `LABEL_DISPLAY` 統一顯示名稱（含 NEEDS_MORE_DATA → NeedsMoreData）。

### 2.3 成功率成績單（scorecard.tsx）

- **KPI 說明列**：頁面上方新增一 Card，說明「成功率 = Winner 數／本月上線數」「Lucky 率 = Lucky 數／本月上線數」「漏斗通過率 = 漏斗健康達標占比」「平均品質分 = ROI + 漏斗 + 置信度綜合分數」。
- **Buyer／Creative**：tab 文案改為「按人（Buyer／Creative 兩張表）」；「依買手」改為「Buyer 成績」＋一句說明；「依素材負責人」改為「Creative 成績」＋一句說明。

### 2.4 GA4 頁面分析（ga4-analysis.tsx）

- **空狀態 onboarding**：當 `!directorLoading && !directorSummary` 時，在主要內容上方顯示一張 Card「GA4 頁面分析 — 使用步驟」：① 確認已串接 Property ② 選擇資產後點「更新資料」③ 若仍無資料前往設定中心檢查 GA4 連線；並提供「前往設定中心」按鈕。

### 2.5 RICH BEAR 審判官頁（judgment.tsx）

- 左側「常用審判模式、最近使用模板、快速上傳素材、快速入口（商品作戰室、今日決策中心、素材生命週期）」與右側「資料來源：Meta · GA4 · ROI 漏斗規則引擎 · 任務與歷史操作」已在 Phase 1 實作；本輪僅將左側「最近模板」改為「最近使用模板」。

### 2.6 團隊權限（team-settings.tsx）

- **三張 Coverage 管理卡**：取代單一 Alert，改為三張 Card：
  1. 缺 primary owner 的在投商品（數量、前 3 筆、立即處理）
  2. 缺 backup owner 的在投商品（同上）
  3. 主責超載的人（數量、前 3 筆含 primary 數、立即處理）
- 「立即處理」按鈕以 `scrollIntoView` 捲動至 `#products-section`。
- **Transfer List**：  
  - 左欄標題列加「全選目前篩選」按鈕。  
  - 有搜尋時顯示「搜尋結果：左 X 筆、右 Y 筆」。  
  - 右欄標題列加「只看已選」勾選，勾選時右欄只顯示目前選取項目。  
- **儲存前 diff**：確認變更 Dialog 改為「變更明細」區塊，分開列出「帳號 · 新增」「帳號 · 移除」「商品 · 新增」「商品 · 移除」（各至多 10 筆＋「…共 N 筆」）。

### 2.7 角色工作流（settings.tsx）

- 在設定中心「AI 作戰設定」Card 下方新增「角色工作流」Card。
- 三張卡：**老闆每天看**、**投手每天看**、**素材／企劃每天看**。
- 每張卡列 4 個核心頁面並以 Link 連結：今日決策中心、RICH BEAR 審判官、成功率成績單、商品作戰室、GA4 頁面分析、素材生命週期、素材中心等依角色分配。

---

## 3. 各頁優化摘要

| 頁面 | 優化重點 |
|------|----------|
| 門檻設定 | 影響頁面說明、每欄說明、極端值提示（minSpend/minSpendForRules 過低） |
| 素材生命週期 | 頁首一句話、空狀態三按鈕、七種 label 顯示一致 |
| 成功率成績單 | KPI 說明 Card、Buyer／Creative 標題與一句說明 |
| GA4 頁面分析 | 無資料時顯示使用步驟 Card + 設定中心連結 |
| RICH BEAR 審判官 | 左/右 Phase 1 已做，本輪僅「最近使用模板」文案 |
| 團隊權限 | 三張 Coverage 卡、Transfer 全選/只看已選/搜尋筆數、diff 新增/移除分列 |
| 設定中心 | 角色工作流區塊、三角色各 4 頁連結 |

---

## 4. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `client/src/pages/settings-thresholds.tsx` | 影響頁面 Card、欄位 description、極端值風險 Card（minSpend/minSpendForRules）、AlertTriangle 圖示 |
| `client/src/pages/creative-lifecycle.tsx` | 頁首副標、空狀態區塊與三按鈕、LABEL_OPTIONS/LABEL_DISPLAY/LabelBadge 七種一致 |
| `client/src/pages/scorecard.tsx` | KPI 說明 Card、Buyer/Creative 區塊標題與說明、移除重複 title 傳入 |
| `client/src/pages/ga4-analysis.tsx` | `!directorSummary` 時顯示 onboarding Card（三步驟＋設定中心按鈕） |
| `client/src/pages/judgment.tsx` | 「最近模板」→「最近使用模板」 |
| `client/src/pages/team-settings.tsx` | 單一 Alert 改三張 Coverage Card、TransferList 全選/只看已選/搜尋筆數、Dialog diff 新增/移除分列、移除 Alert 相關 import、products 區塊 id="products-section" |
| `client/src/pages/settings.tsx` | 「角色工作流」Card、三張角色卡與 4 頁連結、Building2 圖示 |

---

## 5. 驗收步驟

1. **門檻設定**：進入頁面可見「影響頁面」、每欄有說明；將 minSpend 或規則最低花費改為 100 儲存 Draft，應出現「極端值風險提示」。
2. **素材生命週期**：頁首有「此頁依 ROI + Funnel Health…」；無資料時出現三按鈕（素材中心、投放中心、設定中心）；篩選與卡片上 badge 顯示七種標籤一致。
3. **成功率成績單**：上方有 KPI 說明；切換「按人」後可見「Buyer 成績」「Creative 成績」與一句說明。
4. **GA4 頁面分析**：未串接或無資料時，頁面頂部出現「使用步驟」Card 與「前往設定中心」。
5. **RICH BEAR 審判官**：左側有「最近使用模板」、右側證據區有「資料來源：Meta · GA4 · …」。
6. **團隊權限**：上方為三張 Coverage 卡（缺 primary、缺 backup、主責超載）；雙欄有「全選目前篩選」「只看已選」、有搜尋時顯示筆數；儲存前 diff 區分「新增」「移除」列表。
7. **設定中心**：可見「角色工作流」區塊與老闆／投手／素材三張卡、每張 4 個頁面連結可點。

---

## 6. 未完成與原因

- **無。** Phase 2 所列項目均已完成。
- **刻意未做**：任務 schema 擴充、投放中心 wizard、高風險 API 變更（依範圍不納入本階段）。

---

## 7. 截圖

請在實際環境執行上述驗收後，自行擷取以下畫面並貼入本文件或附檔：

- RICH BEAR 審判官（左側＋空狀態／右側證據）
- 門檻設定（影響頁面＋欄位說明＋極端值提示）
- 素材生命週期（頁首＋空狀態或列表＋badge）
- 成功率成績單（KPI 說明＋Buyer/Creative）
- 團隊權限（三張 Coverage 卡＋Transfer 與 diff）
- GA4 頁面分析（onboarding Card）
- 設定中心（角色工作流三張卡）

---

**Phase 2 到此為止；截圖請於實際環境補上。**
