# P4 交付報告

## 1. 完成狀態（P4-1～P4-3 ＋ Team coverage 升級）

| 項目 | 狀態 |
|------|------|
| **P4-1** 新品/素材成功率成績單（按人、按商品） | ✅ |
| **P4-2** 汰換建議自動化 ＋ 一鍵生成任務 | ✅ |
| **P4-3** 資料可信度（unmappedSpend / conflictCount / overrideHitRate → data_confidence） | ✅ |
| **Team coverage** 升級：在投商品缺 primary/backup、主責超載 | ✅ |

---

## 2. 已完成項目

### P4-1：成功率成績單

- **API**：`GET /api/dashboard/scorecard?groupBy=product|person`
  - 依目前 batch 與 lifecycle 分類（success / underfunded / retired）彙總。
  - 回傳：`name`、`launchedCount`（當月在投數）、`successCount`、`successRate`、`avgDaysToTarget`（無歷史為 "-"）、`retirementReasons`（淘汰原因分布）。
  - 按人：以 workbench owner 的 `productOwnerId` 彙總商品維度後再聚合成人。
- **頁面**：`/scorecard`（側欄「成功率成績單」），Tab 切換「按商品」「按人」，每筆顯示本月上線、成功數、成功率、平均達標天數、淘汰原因分布。

### P4-2：汰換建議自動化

- **API**：`GET /api/dashboard/replacement-suggestions`
  - 對 underfunded（高潛力未放大）→ 加碼建議；retired（已疲勞、先停再說）→ 淘汰建議；stalled（需注意、待觀察、待優化）→ 補素材建議。
  - 回傳 `type`、`productName`、`campaignName`、`suggestion`、`action`、`reason`。
- **API**：`POST /api/workbench/tasks/batch`
  - body：`{ items: [{ title, action, reason, productName? }] }`，一次建立多筆任務。
- **UI**：素材生命週期頁（`/creative-lifecycle`）下方「汰換建議」區塊，列出建議 ＋「一鍵生成任務」按鈕（最多 20 筆寫入任務中心）。

### P4-3：資料可信度

- **API**：`GET /api/dashboard/data-confidence`
  - 每商品：`unmappedSpend`（batch 級未映射花費）、`conflictCount`（該商品涉入之創意衝突數）、`overrideHitRate`（該商品花費來自 override 之占比）。
  - 輸出 `data_confidence`：高（unmapped 占比低、無衝突）、中（有少量衝突或 unmapped）、低（unmapped 占比高或衝突多）。
- **UI**：商品作戰室表格新增「可信度」欄，顯示 高/中/低 Badge，hover 顯示未映射花費、衝突數、override 占比。

### Team coverage 升級

- **API**：`GET /api/workbench/coverage-check`
  - 依目前 batch 與 override 解析出「在投商品」（有 spend 的商品）。
  - 對照 workbench owners：`missingPrimary`（缺 productOwnerId）、`missingBackup`（有 primary 但無 mediaOwnerId 且無 creativeOwnerId）、`overload`（同一人擔任 primary 之商品數 > 6）。
- **UI**：團隊權限頁 guardrail 除原有「無帳號/無商品」「帳號無人負責」外，新增：
  - 在投商品缺 primary owner（列至多 5 個商品）；
  - 在投商品缺 backup owner（列至多 5 個）；
  - 主責超載（某人擔任超過 6 個商品 primary，顯示人名與筆數）。

---

## 3. 驗收步驟與結果

| # | 驗收項目 | 步驟 | 結果 |
|---|----------|------|------|
| 1 | P4-1 成績單按商品/按人 | 進入「成功率成績單」，切換按商品/按人，檢查本月上線、成功數、成功率、淘汰原因分布 | ✅ 通過 |
| 2 | P4-2 汰換建議與一鍵任務 | 進入「素材生命週期」，確認有汰換建議區塊，點「一鍵生成任務」，至任務中心檢查新任務 | ✅ 通過 |
| 3 | P4-3 可信度顯示 | 商品作戰室表格有「可信度」欄（高/中/低），hover 可見 unmapped/conflict/override 說明 | ✅ 通過 |
| 4 | Team coverage 升級 | 團隊權限頁：在投商品缺 primary/backup 或主責超載時，Alert 顯示對應警示 | ✅ 通過 |
| 5 | 建置 | `npm run build` | ✅ 通過 |

---

## 4. 未完成與原因

- 無。上述項目均已實作。

---

## 5. Gap list（下一輪可補）

- **P4-1**：平均達標天數需歷史「上線日→達標日」資料，目前無 pipeline 故顯示 "-"；若日後有事件流可接。
- **P4-2**：winner_declining（曾為 winner 但表現下滑）未單獨標籤，目前以「需注意/待觀察」涵蓋補素材建議。
- **P4-3**：unmappedSpend 為 batch 級，各商品顯示同一數值；若需「僅該商品相關 unmapped」需再定義口徑。
- **Coverage**：primary/backup 以 productOwnerId、mediaOwnerId/creativeOwnerId 為準；若需「第二負責人」專用欄位可再擴 schema。

---

## 6. 自我檢查與下一步建議

- **自我檢查**  
  - P4-1～P4-3 與 team coverage 升級皆已接上既有 batch、override、workbench owners。  
  - 成績單與汰換建議皆依現有 lifecycle 標籤（高潛力未放大、已疲勞、先停再說、需注意等）產出。  
  - 建置通過。

- **下一步建議**  
  1. 若有歷史事件（上線/達標日），可接 P4-1 平均達標天數。  
  2. 可依需求新增「第二負責人」欄位並納入 coverage 邏輯。
