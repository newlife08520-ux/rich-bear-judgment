# Phase 1：Runtime 盤點與污染清理 — 交付文件

**對齊**：`docs/華麗熊-總監操盤系統-最終整合版.md` v1.4  
**本輪目標**：盤清 prompt 鏈路、資料來源、舊人格/fallback、無效資料污染；不直接改首頁 UI。  
**完成後**：依 §十八 格式回報，並判斷是否可進入 Phase 2。

---

## A. Runtime Prompt 路徑盤點表

| 路徑／API | UI 入口 | 實際檔案 | 實際函式 | 是否呼叫 getAssembledSystemPrompt | 是否可能 fallback 舊 prompt-builder | 是否讀 published overlay | 是否讀舊 settings prompt 欄位 | 狀態 | 觸發條件／備註 |
|-----------|---------|----------|----------|-----------------------------------|-------------------------------------|---------------------------|-------------------------------|------|----------------|
| POST /api/content-judgment/start | 單次內容審判（一鍵出報告） | server/routes.ts | 內聯 handler（約 L538） | 是 | 否 | 是（getPublishedPrompt(uiMode)） | 否 | 仍使用中 | 每次呼叫皆傳 overrides { systemPrompt, userPrompt } 給 callGeminiContentJudgment，不讀 settings |
| POST /api/content-judgment/chat | 審判官聊天主入口（發送一則訊息） | server/routes.ts | 內聯 handler（約 L668） | 是 | 否 | 是（getPublishedPrompt(effectiveMode)） | 否 | 仍使用中 | 前端 judgment 頁送訊息時呼叫；inferWorkflow(message.content) 推斷 workflow；無 fallback 舊 builder |
| 審判官聊天主入口（同上） | 審判官頁面輸入框送出 | client/src/pages/judgment.tsx | fetch("/api/content-judgment/chat") 約 L1012 | — | — | — | — | 仍使用中 | 帶 sessionId, message, uiMode, workflow |
| 單次 content judgment | 單次審判表單送出 | 同上 API /start | 同上 | 是 | 否 | 是 | 否 | 仍使用中 | 同上 |
| QUICK_PROMPTS | 審判官頁空狀態四大卡 | client/src/pages/judgment.tsx | QUICK_PROMPTS 約 L123（幫我看素材、產出銷售頁架構、發想痛點短影音、找出文案盲點） | — | — | — | — | 仍使用中 | 點擊後帶入預設 text + workflow，實際送訊仍走 /api/content-judgment/chat，故走 getAssembledSystemPrompt |
| 空狀態四大卡 | 同上 | 同上 | 同上 | — | — | — | — | 仍使用中 | 與 QUICK_PROMPTS 同一入口，送訊走 chat → Rich Bear |
| buildContentJudgmentPrompt | 僅在 callGeminiContentJudgment 無 overrides 時 | server/gemini.ts | callGeminiContentJudgment 約 L155-156 | 否 | 是（fallback） | 否 | 是（settings.coreMasterPrompt, settings.modeXPrompt） | 僅 fallback | 目前 production 唯一呼叫端為 routes.ts /start，且**每次都傳 overrides**，故此 fallback 現未被觸發；若未來有他處呼叫 callGeminiContentJudgment 且不傳 overrides 則會進舊路徑 |
| buildFinalSystemPrompt | 僅被 callGeminiJudgment 使用 | server/prompt-builder.ts | buildFinalSystemPrompt L4 | 否 | — | 否 | 是（coreMasterPrompt, modeXPrompt） | 死碼（見下） | 無 route 呼叫 callGeminiJudgment |
| callGeminiJudgment | 無 | server/gemini.ts | callGeminiJudgment L51 | 否 | — | 否 | 是（經 buildFinalSystemPrompt） | 死碼 | 已搜全 repo：無任何 server 或 client 呼叫此函式；僅文件與 .local 提及；production 不可達 |
| getAssembledSystemPrompt（靈感池延伸） | 素材生命週期頁「靈感池」AI 延伸 | server/routes.ts | 約 L1985 內聯 | 是 | 否 | 否（此處未傳 customMainPrompt） | 否 | 仍使用中 | getAssembledSystemPrompt({ uiMode: "creative", judgmentType: "extension_ideas", dataContext })；未讀 settings 人格 |

**說明**：文件中之「POST /api/review-sessions/message」在程式庫中**不存在**；審判官聊天實際為 **POST /api/content-judgment/chat**。

---

## B. Runtime 資料來源盤點表

| 頁面／區塊 | 對應 API | 對應 store／batch／summary／table | 是否 latest valid batch | 是否可能讀到舊 batch | 是否可能混入花費 0 | 是否可能混入樣本不足 | 是否可能混入未分類商品／素材 | 是否已具備成本比判斷 | 是否已具備 GA 證據區分 | 備註 |
|------------|----------|------------------------------------|--------------------------|----------------------|---------------------|----------------------|------------------------------|------------------------|-------------------------|------|
| Dashboard 第一屏（今日決策中心） | /api/dashboard/action-center, /api/dashboard/cross-account-summary, /api/dashboard/account-ranking, /api/dashboard/anomaly-summary | storage.getLatestBatch(userId, scopeKey) → batch；batch.summary；batch.campaignMetrics | 是（getLatestBatch） | 是（同一 userId 可能有多 scopeKey，未傳 scope 時用 userId 為 key；舊 batch 可能仍存在於 batchStore 其他 key） | 部分：action-center 之 creativeLeaderboard 已濾掉 spend≤0；productLevel 為商品聚合，可能含來自低花費／0 轉換的 campaign；budgetActionTable 含全部 campaign 未先濾花費 0 | 是：action-center 有 dataStatus（no_delivery/under_sample/decision_ready）但 budgetActionTable 仍列出全部，未在核心區僅顯示 decision_ready | 是：productName 來自 resolveProduct，無 mapping 時為「未分類」；productLevel / creativeRaw 可含未分類 | 是：action-center 使用 getProductProfitRule、costRuleStatus「已設定／待補」；breakEvenRoas/targetRoas | 部分：summary 與 campaign 層為廣告數據；GA 漏斗為另一批 API（ga4），未在首屏強制區分「廣告層推測」vs「GA 證據」 | 首屏以帳號 ranking、anomaly、action-center 為主；尚未改為「今日最該動 5 件事」等五區 |
| 今日最該動的 5 件事 | 無專用 API | — | — | — | — | — | — | — | — | 規格有，目前無雛形；action-center 有 productLevel/creativeLeaderboard/urgentStop/riskyCampaigns 等，非以「5 件事」呈現 |
| 主力商品戰情 | 同上 action-center | productLevel、creativeLeaderboard | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 | 來自 action-center 之 productLevel |
| 高預算危險商品 | 同上 action-center、/api/dashboard/high-risk | budgetActionTable、riskyCampaigns、batch.riskyCampaigns | 同上 | 同上 | riskyCampaigns 已濾 spend>0；high-risk API 用 getBatchFromRequest | 同上 | 同上 | 同上 | 同上 | 有高花費無轉換、risky 列表 |
| 黑馬素材 | 同上 action-center | hiddenGems（商品層）、creativeLeaderboard（創意層） | 同上 | 同上 | hiddenGems 已濾 spend>0；creativeLeaderboard 已濾 spend>0 | 創意榜未再濾樣本不足；scaleReadiness 有 confidenceScore | 未分類會進 productLevel／creativeRaw | 同上 | 同上 | buried-gems 為「高潛力未放大」標籤 |
| 商品作戰室主表 | /api/dashboard/action-center（scopeProducts 等） | productLevel、budgetActionTable | 同上 | 同上 | budgetActionTable 含全部 campaign（含花費 0） | 有 sampleStatus/dataStatus，但表仍全列 | 有「未分類」 | 有 costRuleStatus、breakEvenRoas、targetRoas | 部分 | 商品頁可能指 products 頁或 dashboard 的 product 區塊 |
| 商品詳情頁 | 無單一「商品詳情」API | 可由 action-center 或 campaign 層資料組出 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 | 需再確認是否有獨立商品詳情路由與 API |
| 素材生命週期頁 | /api/dashboard/creative-lifecycle | getBatchFromRequest → batch.campaignMetrics；toRoiRows、computeBaseline、7 階段分桶 | 是 | 同上 | 有 FIRST_DECISION_SPEND_MIN/MAX 與階段邏輯；items 含各階段 campaign，未明確排除 spend 0 於「核心」展示 | 有 confidence 與 baseline；under_sample 會進 underfunded 等 | 有 resolveProduct，未分類會出現 | 有 getProductProfitRule、breakEven 等 | 部分 | 靈感池會呼叫 getAssembledSystemPrompt 做延伸 |
| 素材作戰台／創意焦點區 | /api/fb-ads/creatives, /api/fb-ads/buried-gems, /api/fb-ads/stop-list, action-center creativeLeaderboard | batch.campaignMetrics、creativeRaw | 同上 | 同上 | buried-gems/stop-list 為篩選後；creativeLeaderboard 已濾 spend>0 | 依 scaleReadiness、materialTier | 未分類會進 | 有 rule、scaleReadiness | 部分 | 多個 API 並存 |
| 成功率頁／scorecard | /api/dashboard/scorecard | getBatchFromRequest → batch；groupBy person/product；getWorkbenchMappingOverrides | 是 | 同上 | 依 batch 內 campaign 與決策點定義 | 依 luckyRate、funnelPassRate、avgQualityScore 等定義 | 依 product 歸屬 | 未在此 API 直接做成本比 | 部分（funnel 相關） | 定義「未進決策點」vs「真正失敗」需對齊規格 |
| cross-account summary | /api/dashboard/cross-account-summary | batch.summary、storage.getSyncedAccounts | 是 | 同上 | summary 來自 batch，可能含 0 轉換等 | 同上 | 同上 | 同上 | 同上 | 首屏用於 hasSummary、message |
| account-ranking | /api/dashboard/account-ranking | batch.summary.topPriorityAccounts | 是 | 同上 | 未在此 API 濾花費 0 | 同上 | 同上 | 同上 | 同上 | 帳號維度排序 |
| leaderboard / danger table / product ranking | action-center 之 creativeLeaderboard、riskyCampaigns、budgetActionTable；/api/dashboard/high-risk；/api/fb-ads/high-risk | 同上 | 同上 | 同上 | 見上（部分已濾） | 見上 | 見上 | 見上 | 見上 | 分散多 API |

---

## C. 舊邏輯狀態表

| 名稱 | 檔案 | 現況 | 狀態 | 保留原因／移除原因 | 預計處理 Phase | 是否會影響 production | 備註 |
|------|------|------|------|---------------------|----------------|------------------------|------|
| prompt-builder.ts | server/prompt-builder.ts | 仍被 gemini.ts 與 routes 引用；buildContentJudgmentUserPrompt 被 /start 使用；buildFinalSystemPrompt、buildContentJudgmentPrompt 僅在 fallback／死碼路徑使用 | 待移除（部分保留） | buildContentJudgmentUserPrompt 仍用於 /start 的 userPrompt；buildContentJudgmentPrompt 僅在 callGeminiContentJudgment 無 overrides 時用，目前未觸發；buildFinalSystemPrompt 僅 callGeminiJudgment 用，死碼 | Phase 2：標註 buildFinalSystemPrompt、buildContentJudgmentPrompt 為 deprecated；Phase 3 可考慮移除死碼或保留僅作 fallback 文檔 | 會：若未來有呼叫不帶 overrides 的 content judgment 會進舊人格 | 建議：保留 buildContentJudgmentUserPrompt；其餘兩函式標 deprecated |
| buildFinalSystemPrompt | server/prompt-builder.ts | 僅被 callGeminiJudgment 呼叫 | 死碼 | 無任何 route 呼叫 callGeminiJudgment | Phase 2 標註 deprecated；Phase 3 可移除 | 否（目前無呼叫端） | 已確認全 repo 無呼叫 |
| buildContentJudgmentPrompt | server/prompt-builder.ts | 僅在 callGeminiContentJudgment(..., overrides) 的 overrides 為 undefined 時使用 | 僅 fallback | /start 永遠傳 overrides，故目前不觸發；若日後新增 API 不傳 overrides 會進舊路徑 | Phase 2 標註；Phase 3 可考慮移除或保留為明確 fallback 並在文件註明 | 僅在未傳 overrides 時 | 建議保留註解說明「僅 fallback」 |
| callGeminiJudgment | server/gemini.ts | 無呼叫端 | 死碼 | 無 route 或 client 呼叫 | Phase 2 標註 deprecated；Phase 3 移除 | 否 | 已確認 |
| settings 內舊人格級 prompt 欄位 | shared/schema.ts（coreMasterPrompt, modeAPrompt, modeBPrompt）；server/storage.ts；client/src/pages/settings.tsx | 仍存在並可編輯；storage 預設值為舊版「AI 行銷審判官」文案 | 待移除（人格真源改為 Core） | 新鏈路不讀；但設定頁仍顯示／儲存；若未來有 fallback 會讀到 | Phase 2：設定頁可標示「僅供 fallback／相容」或隱藏；Phase 3 人格完全由 Core 單一來源 | 會（若 fallback 被觸發） | 單一真源為 rich-bear-core.ts |
| 舊 quick prompt 入口 | client judgment 頁 QUICK_PROMPTS | 已改為帶 workflow 與預設文案，送訊走 /api/content-judgment/chat → getAssembledSystemPrompt | 保留 | 已是新鏈路，僅名稱「quick」保留 | — | 否 | 已對齊新鏈路 |
| 舊 dashboard 帳號主視角區塊 | client dashboard 第一屏 | 今日決策中心、account-ranking、cross-account-summary、anomaly 等以帳號／摘要為主 | 待移除（改版） | 規格要求首頁改為「動作+商品」五區，帳號降為輔助 | Phase 2 首頁重做 | 會 | 目前仍為帳號／摘要主視角 |
| 舊排行榜來源 | /api/dashboard/account-ranking、action-center 之 creativeLeaderboard 等 | 來自 getLatestBatch + summary 或 campaignMetrics | 保留（資料源） | 資料源正確，排序與呈現需依規格調整 | Phase 2 調整呈現與排序邏輯 | 會 | 非「移除」而是「不搶主角」 |
| 舊 danger table 來源 | batch.riskyCampaigns、/api/dashboard/high-risk、/api/fb-ads/high-risk | getBatchFromRequest | 保留 | 同上 | Phase 2 高預算危險區塊依影響力排序 | 會 | 同上 |
| 舊 leaderboard 來源 | action-center creativeLeaderboard、account-ranking | 同上 | 保留 | 同上 | Phase 2 黑馬／主力區塊規範 | 會 | 同上 |
| 舊 success／scorecard 指標定義不清 | /api/dashboard/scorecard、luckyRate/funnelPassRate 等 | batch + workbench mapping + 決策點定義 | 保留但需釐清 | 規格要求「未進決策點」不得看起來像「0 成功率」 | Phase 2 或 Phase 3 釐清定義並標示 | 會 | 見 D 污染清單 |

---

## D. 前台污染清單

| 頁面／區塊 | 問題類型 | 畫面表現 | 根因 | 類型 | 預計 Phase | 是否影響決策信任 | 嚴重度 | 備註 |
|------------|----------|----------|------|------|------------|-------------------|--------|------|
| Dashboard 第一屏 action-center 表 | 花費 0／未投遞可能混入主表 | budgetActionTable 列出所有 campaign，含 spend 0 或極低樣本 | action-center 未在「核心決策表」層級排除 no_delivery／under_sample；僅 creativeLeaderboard 濾 spend>0 | 硬邏輯＋資料 | Phase 2 | 是 | 高 | 規格：花費 0 不得進核心區 |
| 商品／創意排行 | 未分類商品／素材進核心區 | productLevel、creativeRaw 中出現「未分類」且可能排在主區 | resolveProduct 無 mapping 時回傳「未分類」；未在核心排序前排除未分類 | 資料＋邏輯 | Phase 2 | 是 | 高 | 規格：未分類不得進主戰場核心 |
| 成本比未設卻被判賺錢／可放大 | 待補成本規則仍顯示建議放大或高 ROAS | getProductProfitRule 無規則時仍算 scaleReadiness、suggestedAction；畫面有 costRuleStatus「待補」但建議可能仍為加碼 | 邏輯未在「無成本規則」時強制降級建議與語氣 | 硬邏輯 | Phase 2 | 是 | 高 | 規格：不得高信心判賺錢／可放大 |
| 高預算危險排序 | 高預算危險未依影響力排序 | riskyCampaigns、high-risk 等可能僅依 ROAS 或單一指標 | 規格要求依影響力排序，非單看 ROAS 升冪 | 硬邏輯 | Phase 2 | 是 | 中 | 見 §13.4 |
| 黑馬素材混入假潛力 | 極小樣本進黑馬／金榜 | creativeLeaderboard 已濾 spend>0，但未再濾 confidence／樣本不足 | scaleReadiness 有 confidenceScore，但創意榜未排除 under_sample | 硬邏輯 | Phase 2 | 是 | 中 | 規格：黑馬區不得極小樣本噪音 |
| 商品排行沒照影響力 | 主力／危險區未按影響力 | productLevel 排序可能按 ROAS 或 spend，非 8:2／影響力 | 規格要求依影響力與優先序 | 硬邏輯 | Phase 2 | 是 | 中 | Phase 2 排序邏輯 |
| 1d／3d／7d 邏輯未正確落地 | 多窗口趨勢未一致用於建議 | 部分 API 有 multiWindow，部分 UI 未顯示或未用於判語 | 分散在 batch、action-center、lifecycle，未統一「穩／掉速」呈現 | 資料＋UI | Phase 2～3 | 是 | 中 | 見規格 1d/3d/7d |
| 無 GA 證據卻講得像漏斗已確診 | 廣告層推測被講成站內問題 | 摘要或建議未區分「廣告層推測」vs「已有 GA 證據」 | 未強制 evidenceLevel／sourceType 於所有判語與說明 | 硬邏輯＋總監語言 | Phase 2～3 | 是 | 高 | 規格：無 GA 不得確診漏斗 |
| workflow 切換只是提示詞 | 切 workflow 僅改預填文字，行為未變 | 審判官頁切 clarify/create/audit 等，後端 inferWorkflow 有變，但空狀態／輸出骨架是否真隨 workflow 變需再確認 | 前端帶 workflow；後端 getAssembledSystemPrompt 有 workflow 參數；需驗證輸出結構與行為是否依 workflow 切換 | UI＋後端 | Phase 2 | 是 | 中 | 規格：workflow 要切行為不是只切提示詞 |
| 舊帳號報表搶走首頁主角 | 首頁先看到帳號 ranking、摘要 | 今日決策中心第一屏為 account-ranking、cross-account-summary、anomaly、action-center 等，以帳號與摘要為主 | 尚未改為「今日最該動 5 件事＋主力＋高預算危險＋黑馬＋節制」五區 | UI＋產品 | Phase 2 | 是 | 高 | 規格：首頁主角為動作與商品 |
| 成功率頁未進決策點像 0 成功率 | 0% 或低數字讓使用者以為系統壞掉 | scorecard 與成功率相關頁若未區分「尚未進決策點」「資料不足」「真正失敗」 | 定義與標示未在前台明確 | 資料＋UI | Phase 2～3 | 是 | 中 | 規格：須標示定義待補／僅供參考 |

---

## E. 靈魂不流失檢查

### 1. 目前哪些 runtime 路徑確定會套用華麗熊核心人格

- **POST /api/content-judgment/start**：每次皆以 getAssembledSystemPrompt（Core + Published Overlay + Calibration + Workflow audit）＋ buildContentJudgmentUserPrompt 經 overrides 傳入 callGeminiContentJudgment，**確定走華麗熊**。
- **POST /api/content-judgment/chat**：同上，getAssembledSystemPrompt(effectiveMode, publishedMain, effectiveWorkflow)，**確定走華麗熊**。
- **靈感池延伸**（creative-lifecycle 內）：getAssembledSystemPrompt({ uiMode: "creative", judgmentType: "extension_ideas", dataContext })，**確定走華麗熊**（惟此處無 published overlay，僅 core + workflow 層）。

### 2. 哪些地方仍可能落回舊 prompt、普通 prompt、或 settings 舊欄位

- **callGeminiContentJudgment 無 overrides 時**：會使用 buildContentJudgmentPrompt(settings, ...)，即 coreMasterPrompt ＋ modeXPrompt。目前 production 唯一呼叫端（/start）**每次都傳 overrides**，故現況不會觸發；若日後新增其他呼叫且未傳 overrides，會落回舊人格。
- **settings 頁**：仍可編輯並儲存 coreMasterPrompt、modeAPrompt、modeBPrompt；這些欄位**未被新鏈路使用**，但若 fallback 被觸發會被讀取。

### 3. 哪些頁面之後的一句總監判語會由「decision engine + 總監語言規格」共同產生

- **規格目標**：首頁主卡、商品主戰場主卡、素材作戰台每張卡、高預算危險卡，應有「一句總監判語」且依 §41（總監判語與對外語言規格）產出，骨架來自 decision engine（qualityLabel、suggestedAction、evidenceLevel 等），語氣來自華麗熊。
- **現況**：action-center、creative-lifecycle、scorecard 等 API 已有部分欄位（如 suggestedAction、reason、whyNotMore、costRuleStatus），但**尚未統一**為「一句總監判語」格式，且**總監語言規格**（§41）尚未在後端／前端產出流程強制落地；審判官聊天與單次審判為 AI 即時產出，可視為已有人格，但非「卡片上一句判語」的穩定產出。

### 4. 哪些頁面目前還沒有接入華麗熊語氣層，因此不能宣稱已有總監味道

- **Dashboard 第一屏**：數字與表格為主，無「一句總監判語」；action-center 有 reason、suggestedAction 等但非依 §41 節奏與禁用句型規範，**不能宣稱已有總監味道**。
- **商品頁（含 products、action-center 商品區）**：同上，多為數據與建議欄位，非總監判語格式。
- **素材生命週期／創意相關頁**：有 AI 延伸（靈感池）為華麗熊；列表與卡片的「一句話」尚未統一總監語言規格。
- **成功率頁／scorecard**：多為指標與定義，無總監判語，**不能宣稱已有總監味道**。

### 5. 哪些地方最容易讓靈魂流失成普通 AI／報表／客服／BI

- **Dashboard 與商品／素材表**：若僅呈現數字＋簡單建議欄位，易像報表或 BI 備註。
- **無總監判語的卡片**：易像「一般分析工具」。
- **資料不足時**：若未依 §41.4／§41.5 收斂語氣（規則缺失、樣本不足、廣告層推測），易裝懂或像普通 AI。
- **禁用句型**（§41.8）：若出現「建議觀察」「可能可以考慮」等而未補齊為什麼／該做什麼，易像普通 AI。

### 6. Boss／投手／創意三種視角：哪些已是 view overlay，哪些仍可能混成另一套人格

- **後端**：getAssembledSystemPrompt 的 uiMode（boss/buyer/creative）僅影響 **getPublishedPrompt(effectiveMode)**，即 Layer 2 Published View Overlay；同一 Core＋Calibration＋Workflow，**已是 view overlay**。
- **前端**：審判官頁可選 Boss／投手／創意，帶入 uiMode 送 chat；**同一靈魂、不同視角**，未發現另一套人格邏輯。
- **風險**：若日後在設定頁或別處允許「為三視角各寫一大段人格」，會變三套人格；目前 overlay 來自 workbench published，應受 OVERLAY_PERSONA_BLOCKED 等約束。

### 7. Workflow 切換：目前哪些是真切行為，哪些還只是切提示詞或預填文字

- **後端**：inferWorkflow(message.content) 推斷 clarify/create/audit/strategy/task；getAssembledSystemPrompt 傳入 workflow，會影響 **Workflow Overlay**（rich-bear-workflow-overlays 等）與 audit 時 MODE A～E；**有真切影響 system prompt 與任務型態**。
- **前端**：QUICK_PROMPTS 與空狀態卡帶入預設 text ＋ workflow；使用者亦可手選 workflow。**送訊後行為依 workflow 變**；空狀態提示與輸出骨架是否「完全」隨 workflow 切換（例如 audit 出評分卡、create 出架構）需逐 workflow 驗證，目前可視為**部分真切**，未達規格「完全切行為」前不宜宣稱完成。

### 總結

- **目前華麗熊靈魂是否已在 runtime 主鏈路中穩定存在**：**是**。審判官聊天、單次內容審判、靈感池延伸，皆走 getAssembledSystemPrompt，不讀 settings 舊人格欄位；主鏈路已為 Rich Bear Core ＋ Published Overlay ＋ Calibration ＋ Workflow。
- **哪些地方還會流失**：① 若未來有 API 呼叫 callGeminiContentJudgment 而不傳 overrides；② 首頁／商品／素材頁尚未有「一句總監判語」與總監語言規格落地，易像報表；③ 資料不足時若未收斂語氣會裝懂；④ workflow 輸出骨架與空狀態尚未逐項驗證為「真切行為」。
- **can proceed / cannot proceed**：**can proceed**。Prompt 主鏈路已盤清、fallback 已標註、資料來源與污染已列表；可進入 Phase 2 做首頁重做與防污染（花費 0／樣本不足／未分類／成本缺失）落地，並在 Phase 2 補齊總監判語與總監語言規格於首屏與主卡。

---

## 十一、本輪回報格式（強制）

### 1. 完成狀態

- A Runtime Prompt 路徑盤點表：**完成**
- B Runtime 資料來源盤點表：**完成**
- C 舊邏輯狀態表：**完成**
- D 前台污染清單：**完成**
- E 靈魂不流失檢查：**完成**

### 2. 實際修改檔案

本輪**未修改程式**，僅產出盤點文件：

- **新增**：`docs/phase1-runtime-pollution-audit.md`（本文件）

### 3. Runtime Prompt 路徑盤點結論

- **真正走華麗熊新鏈路**：POST /api/content-judgment/start、POST /api/content-judgment/chat、靈感池延伸（creative-lifecycle 內呼叫 getAssembledSystemPrompt）。
- **仍可能 fallback 舊鏈路**：callGeminiContentJudgment 在**未傳 overrides** 時會使用 buildContentJudgmentPrompt(settings, ...)；目前無此呼叫，但程式路徑存在。
- **已可視為死碼**：callGeminiJudgment、buildFinalSystemPrompt 的呼叫鏈；無任何 route 或 server 程式呼叫。
- **仍待移除或標註**：buildFinalSystemPrompt、buildContentJudgmentPrompt 建議 Phase 2 標註 deprecated；callGeminiJudgment 建議標註 deprecated 並於 Phase 3 移除或保留為文檔說明。

### 4. Runtime 資料來源盤點結論

- **首頁第一屏**：吃 /api/dashboard/action-center、cross-account-summary、account-ranking、anomaly-summary；皆經 getBatchFromRequest → getLatestBatch(userId, scopeKey)；可能讀到舊 batch（同一 userId 多 scopeKey 或歷史 key）；action-center 之 creativeLeaderboard 已濾花費 0，budgetActionTable／productLevel 未在核心區排除花費 0／樣本不足／未分類。
- **商品作戰室**：主要來自 action-center 之 productLevel、budgetActionTable；同上 batch 來源；有成本比與 costRuleStatus，但未在無規則時強制降級判語。
- **素材頁**：creative-lifecycle、fb-ads/creatives、buried-gems、stop-list、action-center creativeLeaderboard；同上 batch；部分 API 已濾 spend>0，未統一濾樣本不足與未分類。
- **成功率頁**：/api/dashboard/scorecard；getBatchFromRequest；未進決策點與真正失敗定義未在前台明確標示。
- **最容易混到舊 batch／花費 0／未分類**：action-center 的 budgetActionTable、productLevel、creativeRaw（未分類）；dashboard 未傳 scope 時用 userId 為 key，若曾有多 scope 會取其一，可能有時序／舊資料議題。

### 5. 前台污染重點 TOP 5

1. **問題**：花費 0／未投遞／樣本不足仍可進首頁與商品主表核心區（如 budgetActionTable、productLevel 未排除）。**影響**：決策信任度下降、誤放大或誤止血。**根因**：API 未在核心區強制篩 decision_ready／排除 no_delivery／under_sample。**建議處理**：Phase 2 在 action-center 與首屏核心區僅顯示 dataStatus=decision_ready；或獨立「待驗證區」列出其餘。
2. **問題**：成本比未設定時仍可能顯示「可放大」或高信心賺錢建議。**影響**：誤導投手與老闆。**根因**：scaleReadiness／suggestedAction 在無 rule 時未強制降級。**建議處理**：Phase 2 無 cost rule 時 suggestedAction 不為「放大」、語氣標「規則缺失」、不進主力放大核心區。
3. **問題**：未分類商品／素材進主戰場核心排序。**影響**：優先序失真。**根因**：resolveProduct 回傳「未分類」後未在核心區排除。**建議處理**：Phase 2 核心區排除 productName=未分類；或單獨「未分類」區。
4. **問題**：舊帳號報表搶走首頁主角（account-ranking、cross-account-summary 為首屏主視覺）。**影響**：不符合「今日操盤室」、動作+商品為先的規格。**根因**：尚未做首頁五區改版。**建議處理**：Phase 2 首頁重做為五區，帳號降為輔助。
5. **問題**：無 GA 證據時仍可能被講成漏斗已確診。**影響**：過度確診、決策信任度下降。**根因**：evidenceLevel／廣告層推測未強制進入所有判語與說明。**建議處理**：Phase 2 決策卡與總監判語強制帶 evidenceLevel；§41.4 語氣規則落地。

### 6. 靈魂不流失檢查結論

- **已穩定套用華麗熊核心人格的 runtime 主鏈路**：/api/content-judgment/start、/api/content-judgment/chat、靈感池 getAssembledSystemPrompt。
- **仍可能流失處**：callGeminiContentJudgment 無 overrides 的 fallback；首頁／商品／素材頁尚無「一句總監判語」與 §41 總監語言規格，易像報表或普通 AI。
- **可由 decision engine + 總監語言規格共同產出的頁面**：首頁主卡、商品主戰場主卡、素材作戰台（規格目標）；現況尚未統一產出流程。
- **can proceed**：可進入 Phase 2；需在 Phase 2 內補齊首屏五區、防污染、總監判語與語氣規範。

### 7. Phase 2 前提是否已滿足

- 舊 prompt 路徑是否已足夠清楚：**是**（已列 A 表與 C 表，fallback 與死碼已標）。
- 首頁核心污染是否已可控：**部分**（已盤點並列 TOP 5；實際排除需在 Phase 2 實作）。
- 成本比缺失是否已不再亂判：**否**（尚未實作「無規則不高信心判賺錢」的強制降級）。
- 首頁主角是否可正式改成動作+商品：**尚未**（仍為帳號／摘要主視角；Phase 2 才改版）。
- **can proceed**：**can proceed**。盤點與清單已足，Phase 2 依規格實作防污染與首頁重做即可。

### 8. Commit hash

本輪僅交文件，**無程式 commit**。  
文件：請於儲存本檔後自訂 commit（例：`docs: Phase 1 runtime and pollution audit`）。

---

**文件版本**：Phase 1 交付 v1  
**對齊**：華麗熊-總監操盤系統-最終整合版 v1.4 §十七～§十八、§二十一～§二十二。
