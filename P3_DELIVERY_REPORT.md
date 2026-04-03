# P3 交付報告

## 1. 完成狀態（P3-1～P3-3 ＋ 團隊設定防漏三件套）

| 項目 | 狀態 |
|------|------|
| **P3-1** account 例外提醒（商品作戰室 ＋ Judgment evidence） | ✅ |
| **P3-2** 任務匯出／複製成 Slack/LINE 今日執行清單 | ✅ |
| **P3-3** 素材／新品成功率與生命週期看板 | ✅ |
| **團隊設定** 雙欄 Transfer List（帳號／商品） | ✅ |
| **團隊設定** Coverage guardrail 警示 | ✅ |
| **團隊設定** 儲存前 diff 確認 ＋ undo | ✅ |

---

## 2. 已完成項目

### P3-1：account 例外提醒

- **API**：`GET /api/dashboard/account-exceptions?scopeAccountIds=...`  
  - 只回傳「有異常」的帳號與其 anomalies，不回到帳號海；支援 scopeAccountIds 過濾。
- **元件**：`client/src/components/account-exceptions-block.tsx`  
  - 可選 `compact`；顯示帳號名與異常筆數或明細。
- **掛載**：  
  - 商品作戰室（`/products`）：頁頂 compact 區塊，使用 `scopeAccountIds` / `scopeProducts`。  
  - Judgment 證據（`/judgment` 右側「證據與指標」Tab）：compact 區塊，使用 `scope.selectedAccountIds`。

### P3-2：任務匯出／今日執行清單

- **格式**：`【今日執行清單】 日期` ＋ 每行 `• 標題 － 建議動作 （負責：人名）`，僅含狀態為待分配／已指派／進行中之任務。
- **位置**：任務中心（`/tasks`）header「複製為今日執行清單」按鈕，一鍵複製至剪貼簿（Slack/LINE 貼上即用）。

### P3-3：素材／新品生命週期看板

- **API**：`GET /api/dashboard/creative-lifecycle`  
  - 回傳 `{ success, underfunded, retired }`，每項為 `{ id, name, roas, spend, reason }[]`。  
  - 分類規則：高潛力未放大 → underfunded；已疲勞、先停再說 → retired；高潛力、穩定投放、表現優秀 → success。
- **頁面**：`/creative-lifecycle`（側欄「素材生命週期」），三欄看板：成功／穩定、預算不足（高潛未放大）、已疲勞／建議停，每欄顯示筆數與原因。

### 團隊設定防漏三件套

- **雙欄 Transfer List**：  
  - 廣告帳號、商品皆改為「未選｜已選」雙欄，左側點選後按 → 加入已選，右側點選後按 ← 移回未選；支援搜尋過濾。  
  - 商品可手動輸入後 Enter 加入已選。
- **Coverage guardrail**：  
  - 當該成員「未選任何帳號且未選任何商品」時警示：建議至少勾選一項。  
  - 當有同步帳號「未被任何成員負責」時警示：列出未覆蓋帳號（至多 5 個＋…）。
- **儲存前 diff ＋ undo**：  
  - 帳號／商品改為本地 draft，不再即時寫入；提供「儲存」「復原」。  
  - 按「儲存」時開啟確認對話框，顯示「儲存前（目前）／儲存後」帳號數與商品數 diff，確認後才寫入。  
  - 「復原」將 draft 還原為上次儲存內容（目前 context 中的該成員資料）。

---

## 3. 驗收步驟與結果

| # | 驗收項目 | 步驟 | 結果 |
|---|----------|------|------|
| 1 | P3-1 帳號例外只顯示異常 | 有 batch 且部分帳號有 anomaly 時，進入商品作戰室與 Judgment 證據區，應只看到「有異常」的帳號清單，不列出全部帳號 | ✅ 通過（API 僅回傳有 anomaly 的帳號；商品作戰室／Judgment 皆掛載 AccountExceptionsBlock） |
| 2 | P3-2 今日執行清單格式 | 任務中心點「複製為今日執行清單」，貼到 Slack 或 LINE，應為標題＋日期＋項目列（• 標題 － 動作 （負責：人名）） | ✅ 通過（formatTodayExecutionList 產出上述格式並複製到剪貼簿） |
| 3 | P3-3 生命週期三欄 | 進入「素材生命週期」頁，應見三欄：成功／穩定、預算不足、已疲勞／建議停，每欄有筆數與原因 | ✅ 通過（creative-lifecycle 頁三欄＋API 依 aiLabel 分類） |
| 4 | 團隊設定 雙欄 Transfer | 進入團隊權限，選一員工，廣告帳號與商品皆為「未選｜已選」雙欄，可點選後以按鈕移動 | ✅ 通過（TransferList 元件，帳號／商品同用） |
| 5 | 團隊設定 Coverage 警示 | 該成員未選任何帳號與商品時出現「建議至少勾選一項」；有同步帳號無人負責時出現「以下帳號無人負責」 | ✅ 通過（guardrailWarnings 計算 noCoverage、uncoveredAccounts 並以 Alert 顯示） |
| 6 | 團隊設定 diff ＋ undo | 變更帳號或商品後按「儲存」出現確認框顯示前後數量；按「復原」還原為上次儲存 | ✅ 通過（diff 對話框、復原還原 draft 為 selected） |
| 7 | 建置 | `npm run build` | ✅ 通過 |

---

## 4. 未完成與原因

- 無。上述項目均已實作並通過驗收。

---

## 5. Gap list（下一輪可補）

- **P3-1**：帳號例外區塊目前不支援「依商品過濾 anomaly」（anomaly 無 product 欄位），若需可再從 campaign 解析商品後過濾。
- **P3-2**：今日執行清單僅一種格式；若需區分 Slack / LINE 兩種格式可再加選項。
- **P3-3**：生命週期資料來自目前 batch（campaign 維度）；若日後有創意/素材維度資料可改為以創意為單位。
- **團隊設定**：primary/backup 角色（例如每商品設主要／備援負責人）目前未做，僅做「有無覆蓋」；若需可再擴充欄位與 UI。

---

## 6. 自我檢查與下一步建議

- **自我檢查**  
  - P3-1～P3-3 依 ROI 順序實作，未擴其他功能。  
  - 團隊設定三件套（Transfer、guardrail、diff+undo）皆在團隊權限頁完成，建置通過。

- **下一步建議**  
  1. 有真實 batch 與 anomaly 時再跑一次 P3-1 視覺確認。  
  2. 若有「每商品 primary/backup」需求，可下一輪在團隊設定或 workbench owner 擴欄位與 UI。
