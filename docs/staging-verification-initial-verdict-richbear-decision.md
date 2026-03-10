# Staging 驗收：初審落地、靈感池華麗熊、第一次決策點寫回（633d215）

## 一、確認目前實際部署版本

### 1. Railway 實際部署 commit
**無法由本端取得。** 請您於 deploy 完成後對 staging 執行：

```bash
curl -s "https://您的staging網址/api/version"
```

或於瀏覽器開啟 `https://您的staging網址/api/version`。回應為 JSON：`{ "commit": "完整 sha", "branch": "main", "timestamp": "..." }`。  
**實際部署的 commit 即為該 `commit` 欄位值**（前 7 碼即為 short hash）。

### 2. Repo 目標 commit
**633d215**（完整 SHA：633d215ecd4e2fa40f4c6d1f89fb223308a1b016）

### 3. 是否一致
請將上述 curl/瀏覽器取得的 `commit` 前 7 碼與 `633d215` 比對。  
- **一致**：可依本文件 §二 於 staging 執行 A/B/C，並以本文件為驗收基準。  
- **不一致**：代表目前 staging 跑的並非本輪建置，**不可直接以 633d215 當驗收基準**。

### 4. 若不一致：原因與處理方式
- **原因**：Railway 尚未完成 deploy、deploy 失敗、或指向其他 branch/commit。  
- **處理**：至 Railway 後台查看 Deployments 的 commit SHA；若為舊 commit，請觸發重新 deploy 或確認 main 已推播至 633d215 後再驗收。

---

## 二、針對本輪功能做 staging 驗收（只驗三項）

### A. 初審落地

#### 驗收流程（請依序執行）
1. 到審判頁（/judgment），完成一則裁決（需已設定 AI API Key，且 POST /api/content-judgment/chat 回 200）。
2. 在該則裁決卡上找到「活動/素材 ID (campaignId)」輸入框，輸入一筆**確實存在於生命週期中心**的 campaignId（可先到 /creative-lifecycle 從素材清單複製任一 campaign 的 ID 或名稱對應的 campaignId）。
3. 點擊「存為初審」。
4. 成功後到「素材生命週期中心」（/creative-lifecycle），找到同一筆 campaign 的卡片。
5. 驗證該卡片上是否出現**完整初審判決顯示**，例如：
   - 初審 X 分
   - 一句 summary
   - 建議進測試池 / 不建議進測試池
   - reason（簡短原因）
6. **重新整理頁面**（F5 或重新進入 /creative-lifecycle），再確認初審判決是否仍存在。

#### 本機執行結果（commit 633d215）
- **步驟 1**：已進入審判頁並送出「請幫我審這則素材：主圖為產品特寫，文案強調限時優惠。」
- **步驟 2–6**：未執行。原因：**POST /api/content-judgment/chat 回 400**，未取得裁決回覆，故畫面上無裁決卡、無「存為初審」輸入框可操作。
- **Network / API**：`POST http://localhost:5000/api/content-judgment/chat` → **statusCode 400**。常見原因：未在設定頁填寫 AI API Key、或 session/start 流程未完成。
- **後端與前端邏輯**：已依程式確認 — 存初審為 `POST /api/judgment/save-initial-verdict`（body: campaignId, score, summary, recommendTest, reason），寫入 `.data/initial-verdicts.json`；GET /api/dashboard/creative-lifecycle 會對每筆 campaign 呼叫 `getInitialVerdict(campaignId)` 並組出 `firstReviewVerdict` 字串顯示在卡片上。

#### 請您於 staging 回填
- 有沒有成功寫入：  
- 顯示長什麼樣（初審 X 分、summary、建議/不建議、reason）：  
- 重整後有沒有保留：  
- 若失敗，哪一步失敗、Network/API response：  
- 問題歸屬：前端顯示 / 後端寫入 / campaignId 對應失敗 / 其他（請註明）：

#### 最終判斷（staging 執行後填寫）
- [ ] 通過  
- [ ] 部分通過（請註明缺哪一塊）  
- [ ] 失敗（根因：________________）

---

### B. 靈感池前 3 筆華麗熊

#### 驗收流程（請依序執行）
1. 設定頁確認 AI API Key 已填寫且可正常使用。
2. 到「素材生命週期中心」/creative-lifecycle。
3. 找到「靈感池」區塊（需有至少一筆靈感池資料才會顯示）。
4. 檢查**前 3 筆**的「贏在哪」「建議延伸方向」「設計可借什麼」是否為**非固定模板、具華麗熊風格**的文案。
5. 檢查**第 4 筆之後**是否仍為固定模板句（Creative Edge、建議延伸、設計可借的預設文），以確認 fallback 邏輯正常。
6. 針對前 3 筆逐筆判斷：贏在哪是否夠具體、建議延伸是否像設計/投手會用、設計可借是否不是空話。

#### 本機執行結果（commit 633d215）
- **步驟 1–2**：已登入並進入 /creative-lifecycle。
- **步驟 3–6**：未執行。原因：本機**尚無素材或尚未達門檻**，頁面顯示「尚無素材或尚未達門檻」，靈感池區塊未出現，故前 3 筆華麗熊與第 4 筆後 fallback 無法於本機驗證。
- **程式邏輯**：GET /api/dashboard/creative-lifecycle 會對 inspirationPool 前 3 筆以 `getAssembledSystemPrompt(extension_ideas)` + `callGeminiChat` 取得 JSON（winReason, extendDirection, designTakeaway），解析後寫入該筆；無 API key 或呼叫失敗則保留原模板句。

#### 請您於 staging 回填
- 前 3 筆實際內容摘要（贏在哪 / 建議延伸 / 設計可借）：  
- 哪幾句像華麗熊、哪幾句仍像模板：  
- 第 4 筆之後是否為模板（fallback 是否正常）：  
- 若失敗，原因：沒打到 AI / 解析失敗 / 結果太空泛 / 其他：

#### 最終判斷（staging 執行後填寫）
- [ ] 通過  
- [ ] 部分通過（請註明）  
- [ ] 失敗（根因：________________）

---

### C. 第一次決策點寫回狀態

#### 驗收流程（請依序執行）
1. 在生命週期中心用「依階段」篩選「第一次決策點」。
2. 任選一筆素材卡片。
3. 在該卡片的第一次決策點區塊點擊其中一個決策按鈕，例如「開」或「拉高」。
4. 驗證畫面上是否出現「已決策：開」（或所選之決策）。
5. **重新整理頁面**，再確認該筆是否仍顯示「已決策：開」。
6. 切換篩選（例如改為「全部階段」再切回「第一次決策點」）或重新進入頁面，再確認一次。
7. 若系統中有其他地方可讀到此狀態（例如成功率頁、團隊追蹤），一併檢查是否同步。

#### 本機執行結果（commit 633d215）
- **步驟 1–2**：已進入 /creative-lifecycle；篩選器存在（全部階段 / 全部）。
- **步驟 3–7**：未執行。原因：本機**尚無素材或尚未達門檻**，無任何素材卡片、無「第一次決策點」卡片，故決策按鈕與寫回無法於本機驗證。
- **API 與儲存**：`POST /api/dashboard/creative-lifecycle/decision`（body: campaignId, decision）會呼叫 `setCampaignDecision` 寫入 `.data/campaign-decisions.json`；GET lifecycle 會帶出 `savedDecision`，前端 FirstDecisionBlock 會顯示「已決策：{decision}」並在點擊時呼叫上述 API。

#### 請您於 staging 回填
- 哪筆 campaign 被寫入：  
- 寫入前後差異（按鈕前 / 按鈕後 / 重整後）：  
- 重整後是否保留：  
- API response（status、body）：  
- 若失敗，是前端沒更新 / 寫入 store 失敗 / 讀取沒接回來 / 其他：

#### 最終判斷（staging 執行後填寫）
- [ ] 通過  
- [ ] 部分通過（請註明）  
- [ ] 失敗（根因：________________）

---

## 三、驗收完後：三個判斷題（請依 staging 實測內容回答）

### 1. 哪一塊仍不夠像華麗熊
請具體寫出**哪一種句子、哪個區塊、哪種輸出**不像，例如：
- 靈感池「設計可借」太像模板
- 「贏在哪」還只是翻數字
- 延伸方向沒有真正講到鉤子/視覺/情緒/成交槓桿  

（若尚未於 staging 測靈感池，請寫「尚未測」並於測完後補填。）

### 2. 哪一塊體驗最卡
請明講**哪個操作**最卡，例如：
- 存初審必須手打 campaignId 太容易出錯
- 第一次決策點寫回後缺少回饋
- 靈感池資訊夠多但不夠好掃讀
- 找到對應素材需要切頁太麻煩  

（若尚未於 staging 完整操作，請寫「尚未測」並於測完後補填。）

### 3. 下一輪只修哪兩點
**只能列兩點**，且須依本輪驗收結果決定，優先「最影響實用性 / 最影響可信度」。

（請於 §二 A/B/C 與 §三 1、2 回填後再填此欄。）

---

## 四、最終回報格式（填寫後即為本輪收尾）

1. **Railway 實際部署 commit 與 633d215 是否一致**  
   （填：一致 / 不一致；若不一致請註明實際 commit 與處理方式。）

2. **Staging 驗收結果**  
   - **A. 初審落地**：通過 / 部分通過 / 失敗；備註：  
   - **B. 靈感池前 3 筆華麗熊**：通過 / 部分通過 / 失敗；備註：  
   - **C. 第一次決策點寫回**：通過 / 部分通過 / 失敗；備註：  

3. **哪一塊仍不夠像華麗熊**  
   （依 §三 1 填寫。）

4. **哪一塊體驗最卡**  
   （依 §三 2 填寫。）

5. **下一輪只修哪兩點**  
   （依 §三 3 填寫。）

6. **實際修改/補寫的文件**  
   - 本輪：`server/index.ts` 新增 `GET /api/version`；`docs/staging-verification-initial-verdict-richbear-decision.md` 重寫為完整驗收格式（含本機執行結果與 staging 回填欄位）。

7. **Commit hash**  
   - 本輪程式/文件變更之 commit hash（若尚未 commit 請寫「未 commit」；若僅文件則寫該 commit）。
