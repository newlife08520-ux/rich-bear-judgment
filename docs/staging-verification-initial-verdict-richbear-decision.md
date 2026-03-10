# Staging 驗收：初審落地、靈感池華麗熊、第一次決策點寫回

## 一、驗收基準說明（修正版）

- **功能基準**：**633d215**。本輪要驗的功能（初審落地、靈感池前 3 筆華麗熊、第一次決策點寫回）都在此 commit。
- **驗收輔助基準**：**c903a5e**。此 commit 新增 `GET /api/version` 與本驗收文件，用於在 staging 確認「目前跑的是哪一版」。
- **Staging 真正驗收時**：以**目前實際部署版本**為準。先對 staging 打 `GET https://您的staging網址/api/version`，確認回應中的 `commit` 前 7 碼是否為 **c903a5e** 或之後（含本清單格式修正）。若為 c903a5e 或更新，則已含驗收輔助與本文件，功能必含 633d215，可依下方「最終 staging 驗收清單」執行 A/B/C。若回傳更早，請先至 Railway 後台確認部署或重新 deploy 後再驗收。

---

## 二、最終 Staging 驗收清單

### A. 初審落地

**驗收步驟**
1. 到審判頁（/judgment），完成一則裁決（設定頁已填 AI API Key，且 POST /api/content-judgment/chat 回 200）。
2. 在該則裁決卡上找到「活動/素材 ID (campaignId)」輸入框，輸入一筆**確實存在於生命週期中心**的 campaignId（可先到 /creative-lifecycle 從素材清單取得）。
3. 點擊「存為初審」。
4. 到「素材生命週期中心」（/creative-lifecycle），找到同一筆 campaign 的卡片。
5. 確認該卡片上出現完整初審判決：初審 X 分、一句 summary、建議/不建議進測試池、reason。
6. 重新整理頁面，再確認初審判決仍存在。

**通過標準**
- 存為初審後，生命週期該筆卡片顯示完整初審內容（分數、summary、建議/不建議、reason），且重整後仍保留。

**失敗時常見根因**
- 審判未完成：POST /api/content-judgment/chat 回 4xx（未設 AI Key、session 未建立等）。
- 寫入失敗：POST /api/judgment/save-initial-verdict 回 4xx（缺 campaignId、未登入等）。
- 對應不到：輸入的 campaignId 與生命週期中心使用的 id 不一致，或 GET lifecycle 未讀到 initial-verdicts store。
- 前端未更新：寫入成功但畫面未刷新或未顯示初審區塊（可檢查 GET /api/dashboard/creative-lifecycle 回應是否含 firstReviewVerdict）。

---

### B. 靈感池前 3 筆華麗熊

**驗收步驟**
1. 設定頁確認 AI API Key 已填寫且可正常使用。
2. 到「素材生命週期中心」/creative-lifecycle，確認有靈感池區塊（需有符合條件的素材才會出現）。
3. 檢查前 3 筆的「贏在哪」「建議延伸方向」「設計可借什麼」是否為非固定模板、具華麗熊風格的文案。
4. 檢查第 4 筆之後是否仍為固定模板句，以確認無 API key 或失敗時的 fallback 正常。
5. 針對前 3 筆判斷：贏在哪是否具體、建議延伸是否像設計/投手會用、設計可借是否不是空話。

**通過標準**
- 前 3 筆三句為華麗熊產出（有創意判斷、非單純數字翻譯）；第 4 筆起為模板句。

**失敗時常見根因**
- 沒打到 AI：未設 API Key、Key 無效或逾限，前 3 筆仍為模板。
- 解析失敗：Gemini 回傳非 JSON 或格式不符，該筆 fallback 為模板。
- 結果太空泛：回傳雖為 JSON 但內容仍像模板或數字翻譯，需調整 extension_ideas prompt 或 user message。

---

### C. 第一次決策點寫回

**驗收步驟**
1. 在生命週期中心用「依階段」篩選「第一次決策點」。
2. 任選一筆素材，在該卡的第一次決策點區塊點擊其中一個決策按鈕（開 / 拉高 / 維持 / 關閉 / 進延伸池）。
3. 確認畫面上出現「已決策：{所選決策}」。
4. 重新整理頁面，再確認該筆仍顯示「已決策：{所選決策}」。
5. 切換篩選或重新進入頁面，再確認一次。
6. 若有成功率頁或團隊追蹤可讀此狀態，一併確認是否同步。

**通過標準**
- 點擊決策後畫面即時顯示「已決策：X」，重整與重進後仍保留；寫入與讀取一致。

**失敗時常見根因**
- 前端未更新：POST /api/dashboard/creative-lifecycle/decision 成功但畫面未更新（未 invalidate query 或未顯示 savedDecision）。
- 寫入 store 失敗：POST 回 4xx（缺 campaignId、decision 非五選一、未登入等），或 .data/campaign-decisions.json 寫入失敗。
- 讀取沒接回來：GET /api/dashboard/creative-lifecycle 未帶 savedDecision，或前端未把 savedDecision 顯示在 FirstDecisionBlock。

---

## 三、做完 A/B/C 後的判斷方式

**1. 如何判斷哪一塊仍不夠像華麗熊**  
- 只看 **B. 靈感池前 3 筆**。若「贏在哪」只是重述 ROAS/Edge 數字、「建議延伸」像制式句、「設計可借」像通用套話，則該句或該區塊仍不夠像華麗熊。具體標註：哪一句、哪一欄（贏在哪 / 建議延伸 / 設計可借）、像什麼（例如：像模板、只翻數字、沒講到鉤子或視覺）。

**2. 如何判斷哪一塊體驗最卡**  
- 依 A/B/C 實際操作感受：哪一步最耗時、最容易錯、最難理解或最難找到。例如：存初審要手打 campaignId 易錯、決策寫回後無明顯回饋、靈感池資訊難掃讀、要在兩頁間對 campaignId 很麻煩等。指名**具體操作**與**卡點**。

**3. 下一輪兩點應如何選擇**  
- 依「最影響實用性」與「最影響可信度」從本輪結果選兩點，且只列兩點。例如：若初審對應常錯，可列「初審寫入前可選/帶入 campaignId」；若靈感池仍太模板，可列「加強 extension_ideas 輸出或 prompt」。必須對應到本輪 A/B/C 與上述 1、2 的結論，不預設無關項目。

---

## 四、本輪文件與 commit 對應

- **功能 commit**：633d215（初審落地、靈感池華麗熊、第一次決策點寫回）。
- **驗收輔助 commit**：c903a5e（新增 GET /api/version、本驗收文件與修正版基準說明）。
