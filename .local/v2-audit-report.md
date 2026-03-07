# AI 行銷審判官 V2 — Audit + 設計回報

---

## 1. 目前哪些檔案屬於 Persona Brain

| 檔案 | 角色 | 內容 |
|------|------|------|
| `server/prompt-builder.ts` (106 行) | Prompt Router | `buildFinalSystemPrompt()` 把 coreMasterPrompt + mode[A-D]Prompt 組合；`buildJudgmentUserPrompt()` 組合使用者輸入；`getOutputSchema()` 定義每個 Mode 的 JSON 輸出格式 |
| `server/gemini.ts` | AI 呼叫層 | `callGeminiJudgment()` 把組合好的 prompt 送給 Gemini，解析回傳 JSON |
| `server/storage.ts` 第 130-180 行 | Prompt 預設值 | `getSettings()` 裡硬寫了 coreMasterPrompt 和 modeA-D 的預設內容 |
| `shared/schema.ts` | 型別定義 | `promptModeMap` (creative→A, landing_page→B, fb_ads→C, ga4_funnel→D)、`promptModeLabels`、`UserSettings`（含 coreMasterPrompt, mode[A-D]Prompt）、`JudgmentType`、`analysisMode` |
| `client/src/pages/settings.tsx` | UI | 讓使用者編輯 Core Master Prompt 和 4 個 Mode Addon |
| `client/src/pages/judgment.tsx` (1397 行) | UI | 審判任務頁：選類型 → 填入資料 → 送出 → 顯示結果 |
| `docs/ai-brain-system.md` | 文件 | 5-part Prompt System 的技術規格 |

**Hidden Calibration 狀態**：文件中提到過，但實作已簡化為 `coreMasterPrompt` 的一部分，沒有獨立的 hidden calibration 層。

---

## 2. 目前哪些檔案屬於 Decision Logic

| 檔案 | 行數 | 角色 | 內容 |
|------|------|------|------|
| `server/scoring-engine.ts` | 460 | Scoring + Risk | `calculateCampaignTriScore`（3 維分數）、`classifyRiskLevel`（5 級風險）、`evaluateStopLoss`（停損判斷）、`classifyOpportunities`（機會分類）、`calculateAccountTriScore`、`calculatePageTriScore` |
| `server/analysis-engine.ts` | 358 | Anomaly Detection | `detectCampaignAnomalies`（ROAS 下降/CPC 飆升/CTR 下降/素材疲勞）、`detectGA4Anomalies`（CVR 下降/結帳放棄）、`identifyRiskyCampaigns`、`calculateAccountHealth`、`calculateAccountPriorityScore` |
| `server/real-data-transformers.ts` | 948 | Data → UI | `buildRealFbOverview`、`buildRealFbCreatives`、`buildRealBudgetRecommendations`、`buildRealGA4FunnelSegments` 等，把 metrics 轉成 UI 需要的結構 |
| `server/ai-summary-pipeline.ts` | 531 | AI Summary | `generateCrossAccountSummary`：把所有分數/異常/活動打包成文字 prompt 送 Gemini，產出 `CrossAccountSummary`；包含 `buildDeterministicSummary` 作為 API 失敗時的 fallback |
| `server/meta-data-fetcher.ts` | 229 | Data Fetching | `fetchMetaCampaignData`（campaign level insights）、`fetchMultiWindowMetrics`（1d/3d/7d/14d 多窗口） |
| `server/ga4-data-fetcher.ts` | 351 | Data Fetching | `fetchGA4FunnelData`（property 層漏斗）、`fetchGA4PageData`（pagePath + pageTitle 頁面數據） |

---

## 3. A/B/C/D 現在各自綁到哪些頁面與 API

### Mode A — 素材煉金術 (creative)
- **觸發頁面**：`judgment.tsx` → 選 creative 類型
- **API**：`POST /api/judgment/start` → `callGeminiJudgment` → prompt-builder Mode A
- **輸入**：手動上傳素材圖片/影片、廣告文案、情境選擇
- **綁定 policy**：無。純靠 prompt 內容（hookStrength, emotionalTension, visualMemory, conversionPower, ctaClarity）
- **Decision Engine 參與**：無

### Mode B — 轉單說服力 (landing_page)
- **觸發頁面**：`judgment.tsx` → 選 landing_page 類型
- **API**：`POST /api/judgment/start` → `callGeminiJudgment` → prompt-builder Mode B
- **輸入**：目標 URL、手動填 metrics（CVR、跳出率等）、備註
- **綁定 policy**：無。純靠 prompt 內容（persuasionFlow, trustSignals, priceSupport, dropOffRisk, mobileExperience）
- **Decision Engine 參與**：無

### Mode C — 廣告投放判決 (fb_ads)
- **觸發頁面**：`judgment.tsx` → 選 fb_ads 類型
- **API**：`POST /api/judgment/start` → `callGeminiJudgment` → prompt-builder Mode C
- **輸入**：選擇真實 Meta 帳號 → 系統抓取該帳號的 campaign metrics
- **綁定 policy**：無。prompt 內容有 creativeHealth, audienceMatch, fatigue, budgetEfficiency, scalability，但這是讓 AI 自行判斷，沒有綁定 scoring-engine 的計算結果
- **Decision Engine 參與**：**不直接參與**。scoring-engine 的 TriScore、StopLoss 等是在 Dashboard/FB-Ads 頁面的 refresh pipeline 中計算，**不會**傳給 Mode C 的 judgment prompt

### Mode D — 漏斗斷點審判 (ga4_funnel)
- **觸發頁面**：`judgment.tsx` → 選 ga4_funnel 類型
- **API**：`POST /api/judgment/start` → `callGeminiJudgment` → prompt-builder Mode D
- **輸入**：選擇真實 GA4 資源 → 系統抓取漏斗數據
- **綁定 policy**：無。prompt 內容有 landingPageEfficiency, productPageConversion, cartAbandonment, checkoutFriction, overallFunnelHealth
- **Decision Engine 參與**：**不直接參與**。GA4 page scoring 在 refresh pipeline 中計算，不傳給 Mode D

### 數據戰情室（非 A/B/C/D 模式）
- **Dashboard** (`dashboard.tsx`)：用 `POST /api/refresh` pipeline → scoring-engine → analysis-engine → ai-summary-pipeline → 顯示帳號排名、風險活動、TriScore、RiskLevel
- **FB 廣告頁** (`fb-ads.tsx`)：用同一個 refresh pipeline → 顯示活動列表、TriScore、機會看板
- **GA4 分析頁** (`ga4-analysis.tsx`)：用 refresh pipeline → 顯示漏斗分析、頁面排行、頁面比較

---

## 4. 哪些地方互相重疊或越界

### 重疊 1：Mode C prompt vs scoring-engine — 兩套獨立的投放判斷
- **scoring-engine.ts** 有完整的 TriScore + StopLoss + Opportunity 計算，用在 Dashboard/FB-Ads 頁面
- **Mode C prompt** 要求 AI 自行判斷 creativeHealth/audienceMatch/fatigue/budgetEfficiency/scalability
- **問題**：兩者互不知道對方的存在。scoring-engine 算出的停損建議不會進入 Mode C 的 prompt；Mode C 的 AI 可能做出與 scoring-engine 矛盾的判斷

### 重疊 2：Mode D prompt vs GA4 page scoring — 兩套獨立的漏斗判斷
- **scoring-engine.ts** 的 `calculatePageTriScore` 和 `classifyPageRiskLevel` 計算頁面健康度
- **Mode D prompt** 要求 AI 自行判斷 landingPageEfficiency/productPageConversion/cartAbandonment/checkoutFriction
- **問題**：同上。頁面的 TriScore/Leakage Score 不會進入 Mode D 的 prompt

### 重疊 3：analysis-engine vs scoring-engine — 部分功能重複
- **analysis-engine.ts** 的 `identifyRiskyCampaigns` 用簡單 ROAS/花費門檻判斷風險
- **scoring-engine.ts** 的 `classifyRiskLevel` 用 TriScore 做更精細的風險分類
- **問題**：兩套風險判斷邏輯並存，pipeline 中先跑 analysis-engine 再跑 scoring-engine，結果合併但可能不一致

### 重疊 4：analysis-engine.suggestedAction vs ai-summary-pipeline.urgentActions
- analysis-engine 的每個異常帶有 `suggestedAction`（確定性文字）
- ai-summary-pipeline 讓 Gemini 產生 `urgentActions`（AI 生成文字）
- **問題**：兩套建議可能矛盾

### 越界 1：Mode A prompt 涉及 CTR/CPC 判讀
- Mode A 的 prompt 提到 "CTR/CPC 輔助判讀"
- 但 CTR/CPC 的主判斷應該在 Mode C（投放判決）
- **問題**：當 Mode A 和 Mode C 同時對同一個素材做出 CTR 判斷，可能矛盾

### 越界 2：Mode C prompt 涉及 "creativeHealth"
- Mode C 的輸出格式包含 `creativeHealth` 評分
- 但素材健康度應該是 Mode A 的範疇
- **問題**：Mode A 和 Mode C 都在評估素材健康度

---

## 5. 哪些地方仍使用 fallback / demo / hardcoded options

### 已修正（V9 已處理）
- Judgment 頁面的 FB 帳號選單：已改為從 `/api/accounts/synced` 抓真實帳號，無帳號時顯示空狀態提示
- Judgment 頁面的 GA4 資源選單：同上，已改為真實資源
- Dashboard/FB-Ads/GA4 頁面：無帳號時顯示空狀態 + 「更新資料」CTA

### 仍存在的問題

| 位置 | 問題 | 嚴重度 |
|------|------|--------|
| `server/routes.ts:291` | 上傳檔案用 `url: "https://mock-cdn.example.com/uploads/..."` | 中（功能性 mock） |
| `server/storage.ts:92-94` | 硬寫 admin/manager/user 三個帳號密碼 | 低（開發環境用） |
| `server/storage.ts:157` | `opportunityScore` fallback 用 `Math.random()` | 高（虛假分數） |
| `server/ai-summary-pipeline.ts:444` | `buildDeterministicSummary` 是 AI 失敗時的 fallback | 中（可接受的 graceful fallback） |
| `server/routes.ts:634,718` | GA4 資源名稱用 `"GA4 Property " + propertyId` 作為 fallback 名稱 | 低（名稱展示問題） |
| `server/routes.ts:105` | 連線測試用 `gemini-2.0-flash` 而非使用者設定的模型 | 低（測試用途） |

### Scope/State 斷裂問題（你提到的核心問題）

| 症狀 | 根因 |
|------|------|
| 「綁好了卻說找不到」 | `saveBatch` 同時存 scopeKey 和 userId 兩份；`getLatestBatch` 先查 scope、找不到才 fallback 到 userId；但 scope key 的格式拼接邏輯容易 mismatch |
| 「選了帳號卻內容不變」 | Dashboard 讀 `getLatestBatch(userId)` 只取最新一筆，不管 scope；如果先在 FB 頁更新了單一帳號，Dashboard 就會顯示那一筆單帳號的結果 |
| 「UI 選單一套、pipeline 一套、batch 又一套」 | Dashboard 用 `days` integer；FB-Ads 用 `dateRange` string "7"/"custom:..."；GA4 用 `accountId` string。三頁各自管理 selectedAccountIds/selectedPropertyIds state，互不共享 |
| 「找不到卻又能分析」 | sync 狀態和 analysis 狀態是分開的；可能帳號已從 synced 列表移除，但 batch 裡還有舊資料 |

---

## 6. V2 Phase 拆解

### 設計原則

1. **Decision Engine 是核心**：Persona Brain 負責「怎麼說」，Decision Engine 負責「怎麼算」和「怎麼判」。先建 Decision Engine，再讓 Persona Brain 引用它的結果
2. **A/B/C/D 必須綁 Policy**：每個 Mode 的 prompt 不再自行發明判斷，而是接收 Decision Engine 的結果作為「證據」
3. **單一資料流**：統一 scope/state/batch，消除多套並行的問題
4. **先引擎後展示**：先做核心計算邏輯，最後才改 UI

---

### Phase 1：State + Scope 統一（基礎設施）

**目標**：消除「三頁三套 state」的問題，建立統一的資料流管線

| 任務 | 內容 | 檔案 |
|------|------|------|
| P1.1 | 定義 `AppState` 統一型別：`connection_status` / `sync_status` / `selection_status` / `analysis_status` / `data_coverage_status` | `shared/schema.ts` |
| P1.2 | 新增 `GET /api/status/unified` API — 回傳完整的 5 項狀態 | `server/routes.ts` |
| P1.3 | 建立 `useAppState()` React hook — 所有頁面共用 scope/selection/status | `client/src/hooks/use-app-state.ts` |
| P1.4 | 重寫 `saveBatch` / `getLatestBatch` — 改用 `scopeKey = hash(accountIds + propertyIds + dateRange)` 確定性 key | `server/storage.ts` |
| P1.5 | 統一所有頁面的 selectedAccountIds / selectedPropertyIds / dateRange 為共用 state | `dashboard.tsx`, `fb-ads.tsx`, `ga4-analysis.tsx` |

---

### Phase 2：Decision Engine — Scoring + Diagnosis + Recommendation（核心）

**目標**：建立完整的計算引擎，取代 analysis-engine 的簡易判斷

| 任務 | 內容 | 檔案 |
|------|------|------|
| P2.1 | Schema 擴充 — `ScoringResult`（4 分數 + diagnosis_type + recommended_action + time_window_basis + benchmark_basis）、`DiagnosisType`（10 種歸因）、`RecommendedAction`（10 種建議動作）、`AdSetMetrics` / `AdMetrics` | `shared/schema.ts` |
| P2.2 | Scoring Engine 重寫 — Health/Urgency/Opportunity/Confidence 四分數，含帳號/campaign/adset/ad/page/pageGroup 六個層級的計算 | `server/scoring-engine.ts` |
| P2.3 | Diagnosis Engine — 確定性歸因邏輯：根據 CTR/CVR/frequency/跳出率/多窗口趨勢判斷 diagnosis_type | `server/diagnosis-engine.ts`（新建） |
| P2.4 | Recommendation Engine — 根據 diagnosis_type + health + urgency 自動產出 recommended_action | `server/recommendation-engine.ts`（新建） |
| P2.5 | Stop-Loss 重寫 — 4 必要前提 + 6 條件取 4/6 + 3 排除條件 + confidenceNote | `server/scoring-engine.ts` |
| P2.6 | Board Engine — 正式定義 6 個榜單（危險/優先處理/停損/擴量/素材機會/頁面漏損），每個有明確的進入條件和排序規則 | `server/board-engine.ts`（新建） |
| P2.7 | Ad Risk Score — 六因子加權變體，專用於廣告風險排序 | `server/scoring-engine.ts` |

---

### Phase 3：Data Fetching 擴充

**目標**：支援 adset/ad 層級 + landing page 維度

| 任務 | 內容 | 檔案 |
|------|------|------|
| P3.1 | Meta API 新增 `level=adset` 和 `level=ad` 擷取，含 multi-window（1d/3d/7d/14d） | `server/meta-data-fetcher.ts` |
| P3.2 | GA4 新增 `landingPage` 維度報表，合併至頁面資料 | `server/ga4-data-fetcher.ts` |
| P3.3 | Page Leakage Score 計算 | `server/scoring-engine.ts` |

---

### Phase 4：Pipeline 整合 + Policy 綁定

**目標**：統一 refresh pipeline 為完整 11 步流程；建立 A/B/C/D Mode Policy 系統

| 任務 | 內容 | 檔案 |
|------|------|------|
| P4.1 | 重寫 `POST /api/refresh` pipeline 為 11 步驟（resolve scope → resolve date → sync raw → compute metrics → compute scores → diagnosis → recommendations → boards → Gemini summary → save batch → notify UI） | `server/routes.ts` |
| P4.2 | 建立 Policy 系統 — 每個 Mode 正式綁定 policy 文件，policy 包含「什麼數據要傳給 prompt」「什麼 Decision Engine 結果要引用」「什麼不該判」 | `server/policy-engine.ts`（新建） |
| P4.3 | Mode C policy 綁定：scoring-framework-v2 + ad-risk-policy + stop-loss-policy + opportunity-board-policy + time-window-policy → 判決 prompt 自動附帶 ScoringResult + StopLossResult + 排榜結果 | `server/prompt-builder.ts` |
| P4.4 | Mode D policy 綁定：ga-page-intelligence-policy + page-leakage-policy + checkout-friction-policy + time-window-policy → 判決 prompt 自動附帶 PageTriScore + LeakageScore + 漏斗斷點 | `server/prompt-builder.ts` |
| P4.5 | Mode A policy 綁定：creative-analysis-policy + hook-evaluation-policy → 刪除 CTR/CPC 判讀（那是 Mode C 的事），加入素材疲勞訊號（from Decision Engine） | `server/prompt-builder.ts` |
| P4.6 | Mode B policy 綁定：persuasion-structure-policy + conversion-copy-policy → 刪除 GA 漏斗主判斷（那是 Mode D 的事），加入頁面 Leakage Score（from Decision Engine） | `server/prompt-builder.ts` |
| P4.7 | 合併 analysis-engine 到 scoring-engine — 異常偵測邏輯整合進 Diagnosis Engine，不再維護兩套 | 刪除 `server/analysis-engine.ts`，邏輯併入 `server/diagnosis-engine.ts` |

---

### Phase 5：Transformer + AI Summary 更新

**目標**：所有展示層使用 ScoringResult，AI prompt 引用完整 Decision Engine 結果

| 任務 | 內容 | 檔案 |
|------|------|------|
| P5.1 | Transformer 全面更新 — 用 ScoringResult 取代 TriScore，每條建議包含 time_window_basis + benchmark_basis + reason | `server/real-data-transformers.ts` |
| P5.2 | AI Summary Prompt 重寫 — 系統 prompt 引用 6 個榜單 + ScoringResult + DiagnosisType；不讓 AI 自行算分數，只讓它做「最終判斷」和「文字包裝」 | `server/ai-summary-pipeline.ts` |
| P5.3 | 清理 `server/storage.ts:157` 的 `Math.random()` opportunityScore fallback | `server/storage.ts` |

---

### Phase 6：Frontend 全面更新

**目標**：UI 展示 4 分數 + diagnosis + recommended_action + 6 榜單

| 任務 | 內容 | 檔案 |
|------|------|------|
| P6.1 | Dashboard 更新 — ScoringResult 4 分數顯示、RiskLevel Badge、DiagnosisType 標籤、6 榜單區塊 | `client/src/pages/dashboard.tsx` |
| P6.2 | FB-Ads 頁更新 — Campaign/AdSet/Ad 三層切換、ScoringResult 展示、機會/停損/風險榜單 | `client/src/pages/fb-ads.tsx` |
| P6.3 | GA4 頁更新 — Page Health / Leakage / Opportunity 三維顯示、landingPage 維度、PageGroup 聚合 | `client/src/pages/ga4-analysis.tsx` |
| P6.4 | Judgment 頁更新 — Mode C/D 的結果頁面展示 ScoringResult 而非純 AI 分數 | `client/src/pages/judgment.tsx` |
| P6.5 | 統一空狀態處理 — 所有頁面無資料時統一顯示 empty state + 下一步 CTA | 所有頁面 |

---

### Phase 順序與依賴

```
Phase 1 (State) ─────────────────────────────────┐
Phase 2 (Decision Engine) ───────────────────┐    │
Phase 3 (Data Fetching) ──────────────────┐  │    │
                                          ▼  ▼    ▼
                                    Phase 4 (Pipeline + Policy)
                                          │
                                          ▼
                                    Phase 5 (Transformer + AI)
                                          │
                                          ▼
                                    Phase 6 (Frontend)
```

Phase 1/2/3 可以並行開發（互不依賴）。Phase 4 需要 1+2+3 全部完成。Phase 5 依賴 4。Phase 6 依賴 5。

---

### 預估工作量

| Phase | 預估 Tasks | 複雜度 |
|-------|-----------|--------|
| Phase 1 | 5 | 中 |
| Phase 2 | 7 | 高（核心引擎） |
| Phase 3 | 3 | 中 |
| Phase 4 | 7 | 高（整合+policy） |
| Phase 5 | 3 | 中 |
| Phase 6 | 5 | 中 |
| **合計** | **30** | — |

---

## 總結

### 最嚴重的 3 個問題（讓系統真正能做決策）

1. **Mode C/D 和 Decision Engine 完全斷裂**：scoring-engine 算了一堆分數，但 judgment 頁面的 AI prompt 完全不知道這些分數存在。結果是「數據頁」和「審判頁」各做各的判斷，可能矛盾。Phase 4 的 Policy 綁定是解決方案。

2. **三頁三套 State**：Dashboard/FB-Ads/GA4 各自管理 scope/selection/dateRange，saveBatch 的 scope key 拼接邏輯脆弱，導致「選了帳號卻內容不變」。Phase 1 是解決方案。

3. **analysis-engine 和 scoring-engine 兩套判斷邏輯並存**：一套用門檻值、一套用 TriScore，結果合併但可能不一致。Phase 2+4.7 的合併是解決方案。

---

請確認這份 Audit 後告訴我：
- Phase 排序是否認同？
- 是否要調整 Phase 範圍（增減功能）？
- 要我先從哪個 Phase 開始實作？
