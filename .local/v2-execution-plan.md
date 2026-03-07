# AI 行銷審判官 V2 — Execution Plan

## Phase 順序（依你指定）
1. Phase 1：State + Scope 統一
2. Phase 3：Data Fetching 擴充
3. Phase 2：Decision Engine 重寫
4. Phase 4：Pipeline 整合 + A/B/C/D Policy 綁定
5. Phase 5：Transformer + AI Summary 更新
6. Phase 6：Frontend 全面更新

---

## Single Source of Truth（全系統共 4 個真來源）

### 1. Scope SSOT
- **位置**：`client/src/hooks/use-app-scope.ts` → `AppScope` 物件
- **結構**：`{ selectedAccountIds: string[], selectedPropertyIds: string[], datePreset: string, customStart?: string, customEnd?: string, scopeMode: "all" | "selected" }`
- **持久化**：寫入 `localStorage("app-scope")` + URL query params 同步
- **規則**：Dashboard / FB-Ads / GA4 / Judgment 四頁共用同一個 `useAppScope()` hook，不允許任何頁面自建 local scope state
- **後端對應**：POST /api/refresh 的 body 直接傳 AppScope 的值

### 2. Batch SSOT
- **位置**：`server/storage.ts` → `batchStore: Map<string, AnalysisBatch>`
- **Key 格式**：`${userId}::${sorted(accountIds).join(",")}::${sorted(propertyIds).join(",")}::${datePreset}` — 確定性，不可有歧義
- **規則**：
  - `saveBatch(userId, batch)` 存 scopeKey + userId（userId key 永遠指向最新一筆）
  - `getLatestBatch(userId, scopeKey?)` 有 scopeKey 時嚴格匹配；無 scopeKey 時回傳 userId 指向的最新筆
  - 所有 GET /api/dashboard/*, /api/fb-ads/*, /api/ga4/* endpoint 都從 query param 帶入 scopeKey 查詢
- **唯一寫入者**：POST /api/refresh pipeline 的最後一步

### 3. Score SSOT
- **位置**：`AnalysisBatch.campaignMetrics[].scoring` (Phase 2 後) / 現階段 `AnalysisBatch.campaignMetrics[].triScore + riskLevel`
- **規則**：scoring 只在 refresh pipeline 中計算一次，存入 batch；所有 endpoint、transformer、AI prompt 都從 batch 讀取，不重算
- **唯一計算者**：`server/scoring-engine.ts`

### 4. Summary SSOT
- **位置**：`AnalysisBatch.summary: CrossAccountSummary`
- **規則**：summary 只在 refresh pipeline 中由 Gemini AI 產出一次（或 deterministic fallback），存入 batch；所有 endpoint 從 batch 讀取
- **唯一產出者**：`server/ai-summary-pipeline.ts`

---

## Mode A/B/C/D 最終邊界（Phase 4 執行，此處先定義）

### Mode C — 廣告投放判決
- 接收：Decision Engine 的 ScoringResult + StopLossResult + Board entries
- 產出：AI 對投放策略的文字判斷與建議
- 禁止：不可自行重算 health/urgency/opportunity score，不可推翻 Decision Engine 的 stop-loss 結論
- prompt 中明確寫入：「以下分數由 Decision Engine 計算完成，你不需要重新計算」

### Mode D — 漏斗斷點審判
- 接收：Decision Engine 的 Page ScoringResult + leakage_score + 漏斗斷點數據
- 產出：AI 對漏斗問題的文字診斷與修復建議
- 禁止：不可自行重算 page health/leakage score，不可做投放預算最終裁決
- prompt 中明確寫入：同上

### Mode A — 素材煉金術
- 接收：帳號的 creative_fatigue anomalies + 帳號平均 CTR/CPC（作為 benchmark context）
- 產出：素材視覺/文案/hook 的 AI 診斷與改進建議
- 禁止：不可做停損最終裁決，不可做 CTR/CPC 的投放效率判斷（那是 Mode C 的事）
- 補充診斷可以做（如「hook 太弱可能影響 CTR」），但不可推翻 scoring-engine 的 diagnosis

### Mode B — 轉單說服力
- 接收：頁面的 leakage_score + page ScoringResult（如果有）+ 漏斗 drop rate
- 產出：頁面說服結構的 AI 診斷與改進建議
- 禁止：不可做廣告投放調整建議，不可做 GA 漏斗的主判斷（那是 Mode D 的事）
- 補充診斷可以做（如「CTA 不夠明確可能影響轉換」），但不可推翻 scoring-engine 的 diagnosis

### Judgment 頁的最終判斷規則
- Mode C/D：必須建立在正式 batch 的 Decision Engine 結果之上。prompt 附帶 ScoringResult 作為「已確定的事實」
- Mode A/B：可以在沒有 batch 的情況下運作（因為是素材/頁面的定性分析），但如果有 batch 且有相關數據，必須附帶作為 context
- 所有 Mode：Judgment 頁的帳號/資源選擇必須從 synced accounts 讀取，不允許硬寫或示意選項

---

## 舊邏輯收斂明細

### Phase 1 完全停用
| 舊邏輯 | 位置 | 替代 |
|--------|------|------|
| Dashboard `days` state (integer) | `dashboard.tsx:764` | `useAppScope().datePreset` |
| Dashboard `customRange` state | `dashboard.tsx` | `useAppScope().customStart/customEnd` |
| FB-Ads `selectedAccountIds` local state | `fb-ads.tsx:1546` | `useAppScope().selectedAccountIds` |
| FB-Ads `dateRange` local state | `fb-ads.tsx:1547` | `useAppScope().datePreset` |
| GA4 `accountId` local state | `ga4-analysis.tsx:291` | `useAppScope().selectedPropertyIds` |
| GA4 `dateRange` local state | `ga4-analysis.tsx:290` | `useAppScope().datePreset` |
| Judgment `accountId` local state | `judgment.tsx:1026` | `useAppScope().selectedAccountIds[0]` 或 synced account selector |
| Judgment `dateRange` local state | `judgment.tsx:1027` | `useAppScope().datePreset` |
| 舊 `buildBatchKey` 拼接邏輯 | `storage.ts:240-248` | 新的確定性 key 函數 |
| 舊 `getLatestBatch` 多重 fallback | `storage.ts:251-267` | 嚴格 scopeKey 匹配 + userId fallback |

### 暫時保留的 fallback（後續 Phase 處理）
| Fallback | 位置 | 何時移除 |
|----------|------|---------|
| `buildDeterministicSummary` (AI 失敗 fallback) | `ai-summary-pipeline.ts:444` | Phase 5（更新為用 ScoringResult） |
| `identifyRiskyCampaigns` | `analysis-engine.ts:206` | Phase 2 + Phase 4（由 board-engine 取代） |
| `calculateAccountHealth` | `analysis-engine.ts:310` | Phase 2 + Phase 4（由 scoreAccount 取代） |
| `calculateAccountPriorityScore` | `analysis-engine.ts:269` | Phase 2 + Phase 4（由 urgency_score 取代） |
| TriScore 型別和引用 | 全系統 | Phase 6（全面替換為 ScoringResult） |
| Mock CDN URL | `routes.ts:291` | Phase 4（真正的檔案上傳邏輯） |

### Demo options 移除時程
| Demo/Hardcoded | 位置 | Phase |
|----------------|------|-------|
| Judgment 示意帳號 | 已修正（V9 已改用 synced accounts） | 無需處理 |
| Hardcoded users | `storage.ts:92-94` | 不移除（開發環境用） |
| GA4 Property fallback 名稱 | `routes.ts:634,718` | Phase 1（改為從 synced accounts 讀取真名） |

### 舊 transformer/summary builder 影響範圍
| 函數 | 位置 | 影響 | Phase |
|------|------|------|-------|
| `buildRealFbOverview` | `transformers.ts` | 用 TriScore 計算 judgmentScore | Phase 5 替換 |
| `buildRealFbCreatives` | `transformers.ts` | 用 TriScore 產出 trend labels | Phase 5 替換 |
| `buildRealBudgetRecommendations` | `transformers.ts` | 用 TriScore 產出預算建議 | Phase 5 替換 |
| `buildDecisionDataPackage` | `ai-summary-pipeline.ts` | 組裝 TriScore 文字給 AI | Phase 5 替換 |

---

## Phase 1：State + Scope 統一

### 目標
消除四頁四套 state 的問題（Dashboard + FB-Ads + GA4 + Judgment）。建立全應用共用的唯一 active scope，讓 Pipeline → Batch → UI → Judgment 使用同一套 scope key。

### Scope 統一清單（7 項全部走同一個 SSOT）
1. **active scope** → `useAppScope()` hook 的 `AppScope` 物件
2. **refresh pipeline 讀取的 scope** → POST /api/refresh body 直接傳 `AppScope` 的值
3. **batch lookup 讀取的 scope** → GET endpoints 帶 `?scope=` query param，值 = `useAppScope().scopeKey`
4. **dashboard / fb-ads / ga4 / judgment 讀取的 scope** → 全部用 `useAppScope()` 的 scopeKey 查詢 batch
5. **date range scope** → `useAppScope().datePreset` + `customStart` + `customEnd`
6. **selection state** → `useAppScope().selectedAccountIds` + `selectedPropertyIds`
7. **analysis status** → `GET /api/status/unified` 回傳的 `analysis_status`（綁定到 batch 的 scope）

### Tasks

**P1.1：定義 AppScope + DataFlowStatus 型別**
- `AppScope { selectedAccountIds: string[], selectedPropertyIds: string[], datePreset: string, customStart?: string, customEnd?: string, scopeMode: "all" | "selected" }`
- `DataFlowStatus { connectionStatus: { meta: boolean, ga4: boolean }, syncStatus: { metaCount: number, ga4Count: number }, selectionStatus: { metaSelected: number, ga4Selected: number }, analysisStatus: { lastBatchAt: string | null, lastBatchScope: string | null, isStale: boolean }, dataCoverage: "both" | "meta_only" | "ga4_only" | "none" }`
- 新增 `buildScopeKey(userId, accountIds, propertyIds, datePreset)` 純函數（前後端共用）
- 檔案：`shared/schema.ts`

**P1.2：重寫 Batch 存取邏輯**
- `buildBatchKey` 替換為 `buildScopeKey`（前後端一致的確定性 key）
- `saveBatch(userId, batch)` 存 scopeKey + userId（userId key 永遠指向最新筆）
- `getLatestBatch(userId, scopeKey?)` 有 scopeKey 時嚴格匹配；無 scopeKey 時回傳 userId 指向的最新筆
- `getBatchForScope(userId, accountIds, propertyIds, datePreset)` 精確查詢
- 停用舊的 `buildBatchKey` 拼接邏輯
- 檔案：`server/storage.ts`

**P1.3：所有 GET endpoints 支援 scope query param**
- 所有 /api/dashboard/*, /api/fb-ads/*, /api/ga4/* endpoint 加入 `?scope=` query param
- 有 scope → `getLatestBatch(userId, scope)`
- 無 scope → `getLatestBatch(userId)`（backward compat）
- 新增 `GET /api/status/unified` → 回傳 DataFlowStatus（5 項狀態）
- 檔案：`server/routes.ts`

**P1.4：建立 useAppScope() React hook**
- 管理 `AppScope` 的共用 state
- 持久化到 `localStorage("app-scope")`，切頁面不丟失
- 計算 `scopeKey` 屬性（與 backend 的 `buildScopeKey` 格式一致）
- 提供 `setSelectedAccounts()`, `setSelectedProperties()`, `setDateRange()` 等 setter
- 提供 `buildRefreshBody()` → 回傳 POST /api/refresh 需要的 body
- 提供 `buildQueryScope()` → 回傳 `?scope=${scopeKey}` 給 GET endpoints
- 檔案：`client/src/hooks/use-app-scope.ts`（新建）

**P1.5：Dashboard 接入 useAppScope**
- 移除 `days` state、`customRange` state
- 改用 `useAppScope()` 的 datePreset/customStart/customEnd
- Refresh 呼叫改為 `buildRefreshBody()`
- 所有 GET queries 加上 `buildQueryScope()`
- 檔案：`client/src/pages/dashboard.tsx`

**P1.6：FB-Ads 接入 useAppScope**
- 移除 `selectedAccountIds` local state、`dateRange` local state
- AccountManager 的選擇操作改為更新 `useAppScope().setSelectedAccounts()`
- Refresh 呼叫改為 `buildRefreshBody()`
- 所有 GET queries 加上 `buildQueryScope()`
- 檔案：`client/src/pages/fb-ads.tsx`

**P1.7：GA4 接入 useAppScope**
- 移除 `accountId` local state、`dateRange` local state
- AccountSelector 的選擇操作改為更新 `useAppScope().setSelectedProperties()`
- Refresh 呼叫改為 `buildRefreshBody()`
- 所有 GET queries 加上 `buildQueryScope()`
- 檔案：`client/src/pages/ga4-analysis.tsx`

**P1.8：Judgment 接入 useAppScope + 確保真資料來源**
- 移除 Judgment 的 `accountId` local state、`dateRange` local state
- Mode C (fb_ads) 的帳號選擇：讀取 `useAppScope().selectedAccountIds`，如果有 → 預設選第一個；如果沒有 → 顯示所有 synced accounts 讓使用者選
- Mode D (ga4_funnel) 的資源選擇：讀取 `useAppScope().selectedPropertyIds`，同上
- Judgment 的 dateRange 也從 `useAppScope()` 讀取
- 確認：無帳號時顯示空狀態 + CTA，不顯示任何示意選項
- 檔案：`client/src/pages/judgment.tsx`

### 驗收標準
1. FB Ads / Dashboard / GA4 / Judgment 四頁全部使用同一個 `useAppScope()` 的 active scope
2. 在 FB-Ads 頁選了帳號 A → 切到 Dashboard → Dashboard 的 scope 也是帳號 A
3. 在 FB-Ads 頁選了帳號 A → 切到 Judgment Mode C → 帳號選擇預設為帳號 A
4. 自訂日期走同一個 datePreset/customStart/customEnd，切頁不丟失
5. 用帳號 A + 7 天更新資料後，Dashboard/FB-Ads/GA4 讀到的都是同一筆 batch（同 scopeKey）
6. batch lookup 不再依賴舊的脆弱 buildBatchKey，改用 buildScopeKey
7. Judgment 不顯示任何示意帳號/資源，無帳號時顯示空狀態
8. `GET /api/status/unified` 正確區分：已連線/已同步/已選擇/可分析 四種狀態
9. 綁定成功(connection) → 已同步(sync) → 已選擇(selection) → 可分析(analysis) 四個狀態能正確區分顯示

### Phase 1 會停用/收斂的舊邏輯
| 舊邏輯 | 位置 | 替代 | 完全停用 |
|--------|------|------|---------|
| `days` state (integer) | `dashboard.tsx:764` | `useAppScope().datePreset` | 是 |
| `customRange` state | `dashboard.tsx` | `useAppScope().customStart/customEnd` | 是 |
| `selectedAccountIds` local state | `fb-ads.tsx:1546` | `useAppScope().selectedAccountIds` | 是 |
| `dateRange` local state | `fb-ads.tsx:1547` | `useAppScope().datePreset` | 是 |
| `accountId` local state | `ga4-analysis.tsx:291` | `useAppScope().selectedPropertyIds` | 是 |
| `dateRange` local state | `ga4-analysis.tsx:290` | `useAppScope().datePreset` | 是 |
| `accountId` local state | `judgment.tsx:1026` | `useAppScope().selectedAccountIds[0]` | 是 |
| `dateRange` local state | `judgment.tsx:1027` | `useAppScope().datePreset` | 是 |
| `buildBatchKey` 拼接邏輯 | `storage.ts:240-248` | `buildScopeKey` | 是 |
| `getLatestBatch` 多重 fallback | `storage.ts:251-267` | 嚴格 scopeKey 匹配 | 是 |
| GA4 Property fallback 名稱 | `routes.ts:634,718` | 從 synced accounts 讀真名 | 是 |

---

## Phase 3（提前到第二）：Data Fetching 擴充

### 目標
讓系統能抓取 adset/ad 層級的 Meta 數據和 GA4 landing page 維度的數據，為 Decision Engine 提供完整的輸入。

### Tasks

**P3.1：Schema — 新增 AdSetMetrics / AdMetrics 型別**
- `AdSetMetrics`：繼承 CampaignMetrics 的數值欄位，加上 adsetId, adsetName, campaignId
- `AdMetrics`：繼承同上，加上 adId, adName, adsetId, campaignId
- `CampaignMetrics` 新增 `objective` 欄位（campaign objective，用於同類型比較）
- `GA4PageMetricsDetailed` 新增 `landingPageSessions`, `landingPageBounceRate`
- `AnalysisBatch` 新增 `adsetMetrics: AdSetMetrics[]`, `adMetrics: AdMetrics[]`
- 檔案：`shared/schema.ts`

**P3.2：Meta API — adset/ad 層級擷取**
- 新增 `fetchMetaAdSetData(token, actId, dateRange)` → `level=adset`
- 新增 `fetchMetaAdData(token, actId, dateRange)` → `level=ad`
- 擴充 `fetchMultiWindowMetrics` 支援 `level` 參數，campaign/adset/ad 三個 level 共用同一套 multi-window 邏輯
- CampaignMetrics 擷取時補上 `objective` 欄位（從 campaigns API 的 objective field）
- 檔案：`server/meta-data-fetcher.ts`

**P3.3：GA4 — landing page 維度擷取**
- 新增 `fetchGA4LandingPageData(serviceAccountKey, propertyId, datePreset)` — 用 `landingPage` 維度 + sessions/bounceRate/addToCarts/ecommercePurchases/purchaseRevenue
- 在 `fetchGA4PageData` 結果中，把 landingPage 數據 merge 到對應 pagePath 記錄的 `landingPageSessions` / `landingPageBounceRate`
- 檔案：`server/ga4-data-fetcher.ts`

### 驗收標準
1. `fetchMetaAdSetData` 能成功回傳 adset-level 的 metrics
2. `fetchMetaAdData` 能成功回傳 ad-level 的 metrics
3. Multi-window 能在 adset/ad level 產出 1d/3d/7d/14d 快照
4. GA4 landing page 數據能成功 merge 到 page records
5. 編譯通過，現有功能不受影響

### 要移除/收斂的舊邏輯
- 無（純新增）

---

## Phase 2（第三執行）：Decision Engine 重寫

### 目標
建立完整的 Scoring → Diagnosis → Recommendation → Board 計算管線。analysis-engine 收斂為「原始訊號偵測」角色，scoring-engine 擴充為「最終裁決引擎」。

### Tasks

**P2.1：Schema — ScoringResult + DiagnosisType + RecommendedAction**
```
ScoringResult {
  health_score, urgency_score, opportunity_score, confidence_score: number (0-100)
  risk_level: RiskLevel
  primary_issue: string
  diagnosis_type: DiagnosisType
  recommended_action: RecommendedAction
  time_window_basis: string
  benchmark_basis: string
}

DiagnosisType = "creative_fatigue" | "hook_weakness" | "audience_mismatch" |
  "landing_page_mismatch" | "checkout_friction" | "tracking_issue" |
  "budget_misallocation" | "underfunded_winner" | "stable_scaling_candidate" |
  "page_leakage" | "sample_insufficient" | "healthy"

RecommendedAction = "stop_now" | "reduce_budget" | "observe" | "replace_creative" |
  "refresh_angle" | "expand_budget" | "relaunch_test" | "fix_landing_page" |
  "fix_checkout" | "verify_tracking" | "maintain" | "extend_observation"
```
- CampaignMetrics 新增 `scoring?: ScoringResult`（取代 triScore + riskLevel）
- AdSetMetrics / AdMetrics 新增 `scoring?: ScoringResult`
- GA4PageMetricsDetailed 新增 `scoring?: ScoringResult`, `leakage_score?: number`
- AccountHealthScore 新增 `scoring?: ScoringResult`（取代 triScore + riskLevel）
- 保留 `triScore` 和 `riskLevel` 欄位作為 backwards-compat，Phase 6 完成後移除
- 檔案：`shared/schema.ts`

**P2.2：收斂 analysis-engine 職責**
- analysis-engine 只保留「原始訊號偵測」：
  - `detectCampaignAnomalies` → 保留，但移除 `suggestedAction`（建議改由 Recommendation Engine 產出）
  - `detectGA4Anomalies` → 保留，同上
- 移除以下函數（邏輯搬進 scoring-engine）：
  - `identifyRiskyCampaigns` → 由 scoring-engine 的 Board Engine 取代
  - `calculateAccountPriorityScore` → 由 scoring-engine 的 urgency_score 取代
  - `calculateAccountHealth` → 由 scoring-engine 的 account-level ScoringResult 取代
- 檔案：`server/analysis-engine.ts`

**P2.3：Scoring Engine — 四分數計算**
- `scoreCampaign(campaign, accountAvg, peerAvg, roasTarget)` → ScoringResult
  - Health Score：ROAS/CTR/CVR vs avg (50%) + frequency/funnel/stability/sample (50%)
  - Urgency Score：multi-window trend (30%) + anomaly (20%) + burn rate (20%) + no improvement (15%) + inverse confidence (15%)
  - Opportunity Score：ROAS headroom (25%) + consistency (20%) + freq room (15%) + spend share (15%) + CTR/CVR advantage (15%) + freshness (10%)
  - Confidence Score：impressions (30%) + clicks (20%) + conversions (20%) + data days (15%) + window consistency (15%)
- `scoreAdSet` / `scoreAd` → 同上邏輯，peerAvg 改為同 campaign / 同 adset
- `scoreAccount(campaigns, ga4, anomalies)` → 花費加權 campaign scores + GA4 修正
- `scorePage(page, siteAvg, groupAvg)` → ScoringResult + leakage_score
- `scorePageGroup(pages)` → 流量加權聚合
- 檔案：`server/scoring-engine.ts`

**P2.4：Diagnosis Engine**
- `diagnoseCampaign(campaign, accountAvg, anomalies)` → DiagnosisType + primary_issue
- 決策樹：
  - CTR 正常 + CVR 極低 → landing_page_mismatch
  - frequency > 4 → creative_fatigue
  - frequency > 4 + CTR 下降 → audience_mismatch
  - ROAS 惡化 > 30% + CPC 上升 → bid_competition（改名為 audience_mismatch 更合適）
  - 花費占比高 + ROAS 低 → budget_misallocation
  - 花費低 + ROAS 高 → underfunded_winner
  - ROAS 穩定 + freq 低 → stable_scaling_candidate
  - impressions < 1000 → sample_insufficient
  - health >= 70 + urgency < 20 → healthy
- `diagnosePage(page, siteAvg, groupAvg)` → DiagnosisType + primary_issue
  - cart/checkout 跳出率高 → checkout_friction
  - 一般頁面跳出率遠高於站均 → page_leakage
  - CVR 高但流量低 → underfunded_winner
- 檔案：`server/scoring-engine.ts`（合併在同一檔案，避免過度拆分）

**P2.5：Recommendation Engine**
- `recommendAction(diagnosisType, health, urgency, confidence)` → RecommendedAction
- 映射表：
  | diagnosis_type | health<30 + urgency>60 | health<50 + urgency>30 | otherwise |
  |---|---|---|---|
  | creative_fatigue | replace_creative | refresh_angle | observe |
  | landing_page_mismatch | fix_landing_page | fix_landing_page | observe |
  | checkout_friction | fix_checkout | fix_checkout | observe |
  | budget_misallocation | stop_now | reduce_budget | observe |
  | underfunded_winner | expand_budget | expand_budget | maintain |
  | stable_scaling_candidate | expand_budget | expand_budget | maintain |
  | tracking_issue | verify_tracking | verify_tracking | verify_tracking |
  | sample_insufficient | extend_observation | extend_observation | extend_observation |
  | healthy | maintain | maintain | maintain |
- confidence < 30 時強制 → extend_observation
- 檔案：`server/scoring-engine.ts`

**P2.6：Stop-Loss 重寫**
- 4 必要前提：sample (imp>=1000, clicks>=30, spend>=100), multi-window (roas_3d < target AND roas_7d < target), spend threshold (spend_7d > max(500, accountDailyAvg*3)), not page issue (diagnosis_type !== landing_page_mismatch)
- 6 條件取 4/6：roas multi-window, vs accountAvg 50%, vs peerAvg 70%, bottom 20%, no 3d improvement, extreme spend inefficiency
- 3 排除：confidence < 30, page issue + CTR ok, recent 1d recovery, already paused
- StopLossResult 新增 `vsPeerAvgMet`, `notPageIssueMet`, `confidenceNote`
- 檔案：`server/scoring-engine.ts`

**P2.7：Board Engine**
- 6 個榜單：
  1. 危險榜 (danger_board)：risk_level = danger，按 urgency_score 降序
  2. 優先處理榜 (priority_board)：urgency >= 50 且 health < 50，按 urgency 降序
  3. 停損榜 (stop_loss_board)：shouldStop = true，按 spend 降序
  4. 擴量榜 (scale_board)：opportunity_score >= 50 且 confidence >= 40，按 opportunity_score 降序
  5. 素材機會榜 (creative_opportunity_board)：diagnosis = creative_fatigue/hook_weakness 且 基礎 ROAS 還可以，按機會分數降序
  6. 頁面漏損榜 (page_leakage_board)：leakage_score >= 40，按 leakage_score 降序
- 每個榜單輸出統一介面 `BoardEntry { entityType, entityId, entityName, scoring, rank }`
- 檔案：`server/board-engine.ts`（新建）

### 驗收標準
1. `scoreCampaign` 對一個有 multi-window 數據的 campaign 能產出完整的 ScoringResult（4 分數 + diagnosis + action）
2. `scorePage` 能產出 ScoringResult + leakage_score
3. Stop-loss 新邏輯能正確處理 page issue 排除
4. Board Engine 能根據 scored campaigns/pages 產出 6 個榜單
5. analysis-engine 只保留 anomaly detection，不再有 identifyRiskyCampaigns / calculateAccountHealth
6. 編譯通過

### 要移除/收斂的舊邏輯
- `analysis-engine.ts`：移除 `identifyRiskyCampaigns`, `calculateAccountPriorityScore`, `calculateAccountHealth`
- `scoring-engine.ts`：重寫 `calculateCampaignTriScore` → `scoreCampaign`，`classifyRiskLevel` 整合進 `scoreCampaign`，`calculateAccountTriScore` → `scoreAccount`，`calculatePageTriScore` → `scorePage`
- TriScore 型別在 Phase 6 完成後移除（Phase 2 先保留 backwards-compat）

---

## Phase 4：Pipeline 整合 + A/B/C/D Policy 綁定

### 目標
重寫 refresh pipeline 為完整 11 步驟流程，並建立 Mode Policy 系統讓 A/B/C/D 的 prompt 自動附帶 Decision Engine 的結果。

### Tasks

**P4.1：重寫 POST /api/refresh Pipeline**
11 步驟：
1. Resolve scope（從 request body 取 selectedAccountIds/selectedPropertyIds，或 useAppScope 傳來的 scopeKey）
2. Resolve date range（統一格式）
3. Sync raw data（Meta campaign + adset + ad；GA4 funnel + page + landing page）
4. Compute metrics（attach multi-window to all levels）
5. Compute scores（scoreCampaign/scoreAdSet/scoreAd/scorePage/scoreAccount）
6. Run diagnosis（diagnoseCampaign + diagnosePage on all entities）
7. Generate recommendations（recommendAction on all entities）
8. Build boards（6 個榜單）
9. Generate Gemini summary（把 ScoringResult + boards 傳給 AI）
10. Save analysis batch（用 unified scope key）
11. Notify UI（設定 refreshStatus）

- 新增 `/api/fb-ads/campaigns-scored` → 回傳帶 ScoringResult 的 campaigns
- 新增 `/api/fb-ads/adsets-scored` → 回傳帶 ScoringResult 的 adsets
- 新增 `/api/fb-ads/ads-scored` → 回傳帶 ScoringResult 的 ads
- 新增 `/api/boards` → 回傳 6 個榜單
- 檔案：`server/routes.ts`

**P4.2：建立 Policy 系統**
- Policy = { requiredDataSources, decisionInputs, boundaries }
  - requiredDataSources：這個 Mode 需要哪些資料
  - decisionInputs：要注入 prompt 的 Decision Engine 結果
  - boundaries：不該判的事情（負面清單）
- 實作為 function `buildPolicyContext(mode, batch)` → 回傳要附加到 prompt 的 context 字串
- 檔案：`server/policy-engine.ts`（新建）

**P4.3：Mode C policy — scoring-framework + ad-risk + stop-loss + opportunity-board + time-window**
- prompt 自動附帶：
  - 該帳號所有 campaign 的 ScoringResult（4 分數 + diagnosis + action）
  - stop-loss 結果
  - 6 個榜單中與該帳號相關的 entries
  - multi-window 趨勢摘要
- boundaries：不判素材視覺設計、不判頁面文案細修
- 檔案：`server/policy-engine.ts`, `server/prompt-builder.ts`

**P4.4：Mode D policy — ga-page-intelligence + page-leakage + checkout-friction + time-window**
- prompt 自動附帶：
  - 該資源所有 page 的 ScoringResult + leakage_score
  - 漏斗斷點（biggest drop between funnel stages）
  - landing page 維度數據
  - 頁面漏損榜
- boundaries：不判素材設計、不做投放預算最後裁決
- 檔案：`server/policy-engine.ts`, `server/prompt-builder.ts`

**P4.5：Mode A policy — creative-analysis + hook-evaluation**
- prompt 附帶：
  - 該帳號的 creative_fatigue / hook_weakness 類型的 anomalies
  - 該帳號的平均 CTR/CPC（作為 benchmark，但不做停損判讀）
- boundaries：不做停損最終裁決、不做頁面漏斗主判斷
- 刪除 Mode A prompt 中的 CTR/CPC 判讀邏輯
- 檔案：`server/policy-engine.ts`, `server/prompt-builder.ts`

**P4.6：Mode B policy — persuasion-structure + conversion-copy**
- prompt 附帶：
  - 該頁面的 leakage_score 和 page ScoringResult（如果有的話）
  - 漏斗中該頁面的 drop rate
- boundaries：不做廣告投放調整、不做 GA 漏斗主判斷
- 檔案：`server/policy-engine.ts`, `server/prompt-builder.ts`

**P4.7：收斂 analysis-engine**
- 確認 routes.ts 中不再直接呼叫 `identifyRiskyCampaigns` / `calculateAccountHealth`
- 這些邏輯改由 scoring-engine + board-engine 取代
- 更新所有 import
- 檔案：`server/routes.ts`, `server/analysis-engine.ts`

### 驗收標準
1. POST /api/refresh 完整跑完 11 步驟，batch 正確存入
2. Mode C judgment 的 prompt 自動包含該帳號的 ScoringResult + 停損結果 + 榜單
3. Mode D judgment 的 prompt 自動包含頁面 ScoringResult + leakage_score + 漏斗斷點
4. Mode A 不再包含停損判讀邏輯
5. Mode B 不再包含 GA 漏斗主判斷邏輯
6. `identifyRiskyCampaigns` 和 `calculateAccountHealth` 不再被任何地方呼叫

### 要移除/收斂的舊邏輯
- routes.ts 中對 `identifyRiskyCampaigns`, `calculateAccountHealth` 的呼叫
- prompt-builder 中 Mode A 的 CTR/CPC 判讀相關文字
- prompt-builder 中 Mode C 的 `creativeHealth` 評分（改為引用 scoring-engine 結果）

---

## Phase 5：Transformer + AI Summary 更新

### 目標
所有展示層數據使用 ScoringResult，AI prompt 引用完整 Decision Engine 結果。

### Tasks

**P5.1：Transformer 全面更新**
- `buildRealFbOverview`：使用 `scoring.health_score` 取代 `triScore.health`
- `buildRealFbCreatives`：每條建議包含 `time_window_basis`, `benchmark_basis`, `diagnosis_type`
- `buildRealBudgetRecommendations`：使用 `scoring.recommended_action` 作為建議來源
- 所有 transformer 輸出加上 `diagnosis_type` 和 `recommended_action` 的繁中標籤
- 檔案：`server/real-data-transformers.ts`

**P5.2：AI Summary Prompt 重寫**
- `buildDecisionDataPackage` 改為傳入 ScoringResult + 6 個榜單 + DiagnosisType
- 明確告訴 AI：「以下分數由 Decision Engine 計算，你不需要重算，只需做最終判斷和文字包裝」
- 引用具體 benchmark_basis 和 time_window_basis
- 檔案：`server/ai-summary-pipeline.ts`

**P5.3：清理 buildDeterministicSummary**
- 更新 fallback 邏輯使用 ScoringResult 而非 TriScore
- 檔案：`server/ai-summary-pipeline.ts`

### 驗收標準
1. Transformer 輸出包含 ScoringResult 欄位
2. AI prompt 包含 Decision Engine 結果
3. 編譯通過，現有功能不受影響

### 要移除/收斂的舊邏輯
- Transformer 中所有 `triScore.health` / `triScore.urgency` / `triScore.scalePotential` 的引用 → 改用 `scoring.*`
- AI prompt 中的 "你自行判斷" 文字 → 改為 "Decision Engine 已判斷"

---

## Phase 6：Frontend 全面更新

### 目標
UI 展示 4 分數 + diagnosis + recommended_action + 6 榜單。移除所有 TriScore 顯示。

### Tasks

**P6.1：Dashboard 更新**
- 帳號卡片：顯示 ScoringResult 4 分數（health/urgency/opportunity/confidence）
- DiagnosisType 標籤（繁中 badge）
- RecommendedAction 標籤
- RiskLevel badge（沿用既有 5 色）
- 6 榜單區塊（摺疊式，各榜 top 5）
- 檔案：`client/src/pages/dashboard.tsx`

**P6.2：FB-Ads 頁更新**
- Campaign / AdSet / Ad 三層切換（tab）
- 每個實體顯示 ScoringResult + diagnosis + action
- 停損榜 + 擴量榜 + 素材機會榜 作為獨立 section
- 機會看板用 OpportunityCandidate（帶 ScoringResult）
- 檔案：`client/src/pages/fb-ads.tsx`

**P6.3：GA4 頁更新**
- 頁面排行增加 leakage_score 欄位
- 頁面比較支援 leakage_score
- 頁面漏損榜作為獨立 section
- Landing page 維度的數據顯示
- 檔案：`client/src/pages/ga4-analysis.tsx`

**P6.4：Judgment 頁更新**
- Mode C/D 結果頁面展示 ScoringResult（4 分數圓環）+ DiagnosisType + RecommendedAction
- Mode A/B 結果保持 AI 分數，但新增 benchmark context（如果有可用數據）
- 檔案：`client/src/pages/judgment.tsx`

**P6.5：清理 TriScore 遺留**
- 移除 `TriScoreMini` 組件
- 移除所有 `triScore` 引用
- 移除 schema 中的 `TriScore` 型別（如果所有引用都已替換）
- 統一空狀態處理：所有頁面無資料時統一 empty state + 下一步 CTA
- 檔案：所有前端頁面, `shared/schema.ts`

### 驗收標準
1. Dashboard 顯示 4 分數 + diagnosis + action，不再顯示 TriScore
2. FB-Ads 有 Campaign/AdSet/Ad 三層切換
3. GA4 頁面排行有 leakage_score
4. Judgment Mode C/D 結果包含 Decision Engine 的分數
5. 全應用無 TriScore 殘留引用
6. 所有頁面 100% 繁體中文

### 要移除/收斂的舊邏輯
- `TriScoreMini` 組件
- `TriScore` 型別
- 所有 `triScore.health` / `triScore.urgency` / `triScore.scalePotential` 的 UI 引用
- 舊版 `riskLevelConfig` 如果不再需要

---

## 檔案影響總覽

| 檔案 | Phase | 變動類型 |
|------|-------|---------|
| `shared/schema.ts` | 1,3,2 | 大幅擴充 |
| `server/storage.ts` | 1 | 重寫 batch 存取 |
| `server/routes.ts` | 1,4 | 新 endpoint + pipeline 重寫 |
| `server/meta-data-fetcher.ts` | 3 | 新增 adset/ad 擷取 |
| `server/ga4-data-fetcher.ts` | 3 | 新增 landing page 擷取 |
| `server/scoring-engine.ts` | 2 | 完全重寫 |
| `server/analysis-engine.ts` | 2,4 | 收斂為 anomaly-only |
| `server/board-engine.ts` | 2 | 新建 |
| `server/policy-engine.ts` | 4 | 新建 |
| `server/prompt-builder.ts` | 4 | 加入 policy context |
| `server/real-data-transformers.ts` | 5 | 全面更新 |
| `server/ai-summary-pipeline.ts` | 5 | prompt 重寫 |
| `client/src/hooks/use-app-scope.ts` | 1 | 新建 |
| `client/src/pages/dashboard.tsx` | 1,6 | scope wiring + UI 重做 |
| `client/src/pages/fb-ads.tsx` | 1,6 | scope wiring + UI 重做 |
| `client/src/pages/ga4-analysis.tsx` | 1,6 | scope wiring + UI 重做 |
| `client/src/pages/judgment.tsx` | 6 | 結果展示更新 |

---

## 立即修正（已完成）
1. `Math.random()` opportunityScore — 已移除，改為 AI 未回傳時 default 0 → "ignore"
2. analysis-engine vs scoring-engine 責任分工 — 已定義：
   - analysis-engine：原始訊號偵測（anomaly detection only）
   - scoring-engine：最終 scoring / diagnosis / recommendation
   - 具體的搬移邏輯在 Phase 2（P2.2）執行
