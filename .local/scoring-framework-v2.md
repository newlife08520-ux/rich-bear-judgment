# Scoring Framework V2 — 三維多粒度評分引擎

## 一、總覽

### 核心理念

每個分析對象都必須產出完整的 ScoringResult：

```
ScoringResult {
  health_score:        number  // 0-100, 整體健康度
  urgency_score:       number  // 0-100, 是否需要立即處理
  opportunity_score:   number  // 0-100, 是否值得擴量/重啟/加碼
  confidence_score:    number  // 0-100, 樣本可信度
  risk_level:          "danger" | "warning" | "watch" | "stable" | "potential"
  primary_issue:       string  // 主要問題描述 (繁體中文)
  diagnosis_type:      DiagnosisType  // 問題歸因分類
  recommended_action:  string  // 建議行動 (繁體中文)
  time_window_basis:   string  // 評分依據的時間窗口 (e.g. "7d vs prev7d")
  benchmark_basis:     string  // 評分依據的比較基準 (e.g. "帳號平均 / 同類型素材平均")
}
```

### DiagnosisType 問題歸因分類

```
"creative_fatigue"      // 素材疲勞
"audience_exhaustion"   // 受眾飽和
"bid_competition"       // 競價惡化
"landing_page_issue"    // 頁面承接問題
"funnel_leak"           // 漏斗斷裂
"tracking_issue"        // 追蹤異常
"budget_inefficiency"   // 預算效率低落
"seasonal_shift"        // 季節性/外部因素
"sample_insufficient"   // 樣本不足，無法判斷
"healthy"               // 正常運作
```

---

## 二、分析對象層級

### 2.1 Meta 廣告層級

| 層級 | Meta API level | 識別 | 可用欄位 |
|------|---------------|------|---------|
| Account | — (聚合) | accountId | 帳號下所有 campaign/adset/ad 的聚合 |
| Campaign | `level=campaign` | campaignId | spend, impressions, clicks, ctr, cpc, cpm, frequency, actions, action_values, objective, status |
| Ad Set | `level=adset` | adsetId | 同上 + targeting, bid_strategy, daily_budget, lifetime_budget |
| Ad | `level=ad` | adId | 同上 + creative_id, effective_object_story_id |

**資料擷取變更**：現有 `fetchMetaCampaignData` 只用 `level=campaign`。需新增 `level=adset` 和 `level=ad` 的擷取函數。
- `fetchMultiWindowMetrics` 需支援 campaign / adset / ad 三個 level。
- 每個 level 都擷取 4 個時間窗口 (1d/3d/7d/14d) + comparison。

### 2.2 GA4 頁面層級

| 層級 | GA4 維度 | 識別 | 可用指標 |
|------|---------|------|---------|
| Page | pagePath + pageTitle | pagePath | sessions, pageviews, bounceRate, avgEngagementTime, addToCarts, checkouts, ecommercePurchases, purchaseRevenue |
| Page Group | classifyPageGroup(pagePath) | pageGroup | 同頁面指標的聚合 |
| Landing Page | landingPage dimension | landingPagePath | sessions, bounceRate, 轉換相關指標 |

**資料擷取變更**：現有 `fetchGA4PageData` 用 pagePath + pageTitle 維度。需另加：
- `landingPage` 維度的報表 (GA4 Data API 支援 `landingPage` 和 `landingPagePlusQueryString`)。
- Page Group 由聚合產生，不需額外 API 呼叫。

---

## 三、時間窗口系統

### 3.1 窗口定義

每個對象都有 4 個當期窗口 + 4 個比較窗口：

| 窗口 | 當期 | 比較期 | 用途 |
|------|------|--------|------|
| 1d | 昨天 | 前天 | 即時偵測異常 |
| 3d | 近 3 天 | 前 3 天 | 短期趨勢確認 |
| 7d | 近 7 天 | 前 7 天 | 主要判斷依據 |
| 14d | 近 14 天 | 前 14 天 | 穩定性驗證 |

### 3.2 WindowSnapshot 結構（不變）

```
WindowSnapshot {
  spend, revenue, roas, ctr, cpc, cpm, cvr, frequency, impressions, clicks, conversions
}
```

### 3.3 趨勢判斷規則

- **持續惡化**：3d + 7d 都比各自 comparison 差 → urgency +25
- **短期惡化**：1d 差但 7d 仍好 → urgency +10, confidence -10 (可能是噪音)
- **改善中**：3d 比 prev3d 好，且 1d 持續好 → urgency -15
- **震盪**：各窗口不一致 → confidence -15, 不觸發停損

---

## 四、三大核心分數詳細算法

### 4.1 Health Score 健康分數 (0-100)

衡量「目前表現如何」。

#### 4.1.1 Campaign / Ad Set / Ad 的 Health Score

| 因子 | 權重 | 計算 |
|------|------|------|
| ROAS vs 帳號平均 | 18% | ratio = roas_7d / accountAvg.roas; score = clamp(ratio * 50, 0, 18) |
| ROAS vs 同類型平均 | 7% | ratio = roas_7d / peerAvg.roas; score = clamp(ratio * 50 - 40, 0, 7) |
| CTR vs 帳號平均 | 10% | ratio = ctr_7d / accountAvg.ctr; score = clamp(ratio * 50 - 35, 0, 10) |
| CVR vs 帳號平均 | 10% | ratio = cvr_7d / accountAvg.cvr; score = clamp(ratio * 50 - 35, 0, 10) |
| CVR vs 同類型平均 | 5% | ratio = cvr_7d / peerAvg.cvr; score = clamp(ratio * 50 - 40, 0, 5) |
| CPC 效率 (帳號平均/CPC) | 8% | ratio = accountAvg.cpc / max(0.01, cpc_7d); score = clamp(ratio * 50 - 40, 0, 8) |
| 頻率疲勞反比 | 12% | freq<1.5→12, <2.5→10, <3.5→7, <5→3, >=5→0 |
| 漏斗完成率 | 10% | funnelRate = conversions / clicks * 100; score = clamp(funnelRate * 3, 0, 10) |
| 多窗口穩定度 | 10% | 7d 與 14d 的 ROAS 差異 < 15% → 10, < 30% → 6, otherwise → 2 |
| 樣本信心 | 10% | impressions>=10000→10, >=5000→7, >=1000→4, <1000→1 |

**同類型平均 (peerAvg) 定義**：
- Campaign: 同帳號、同 objective 的其他 campaign
- Ad Set: 同 campaign 的其他 adset
- Ad: 同 adset 的其他 ad

#### 4.1.2 Account 的 Health Score

花費加權平均其下所有 campaign 的 health_score，再修正：
- GA4 CVR > 3% → +5
- GA4 結帳放棄率 > 70% → -8
- 異常計數 critical >= 2 → -10

#### 4.1.3 Page 的 Health Score

| 因子 | 權重 | 計算 |
|------|------|------|
| CVR vs 站內平均 | 20% | ratio = page.cvr / siteAvg.cvr; score = clamp(ratio * 50 - 30, 0, 20) |
| CVR vs 同 pageGroup 平均 | 10% | ratio = page.cvr / groupAvg.cvr; score = clamp(ratio * 50 - 35, 0, 10) |
| 跳出率反比 vs 站內平均 | 15% | ratio = siteAvg.bounceRate / max(1, page.bounceRate); score = clamp(ratio * 50 - 30, 0, 15) |
| 跳出率反比 vs 同 group 平均 | 5% | 同上用 groupAvg |
| 互動時間 vs 站內平均 | 10% | ratio = page.engTime / siteAvg.engTime; score = clamp(ratio * 40 - 20, 0, 10) |
| 加入購物車率 | 10% | atcRate = addToCart / sessions * 100; score = clamp(atcRate * 5, 0, 10) |
| 營收貢獻 | 15% | 營收 > 0 → min(revenue / siteTotal * 100 * 5, 15) |
| 多期穩定度 | 15% | CVR 變化 < 10% → 15, < 25% → 10, < 50% → 5, otherwise → 0 |

#### 4.1.4 Page Group 的 Health Score

流量加權平均其下所有 page 的 health_score。

---

### 4.2 Urgency Score 急迫度分數 (0-100)

衡量「多急著需要處理」。越高越緊急。

#### 4.2.1 Campaign / Ad Set / Ad 的 Urgency Score

| 因子 | 最大貢獻 | 計算 |
|------|---------|------|
| 多窗口惡化趨勢 | 25 | 每個窗口的 ROAS/CTR 比 comparison 差 +3, 最多 25 (共 8 比較點) |
| 異常嚴重度 | 15 | critical=15, high=10, medium=5 (取最高) |
| 日燒預算 x 低效率 | 20 | burnRisk = spendShare * (roas<1 ? 2 : 1); score = clamp(burnRisk * 100, 0, 20) |
| 花費佔比 x ROAS<1 | 10 | 佔帳號花費>20% 且 ROAS<1 → 10, >10% 且 ROAS<1.5 → 5 |
| 近期無改善 | 10 | 3d 沒比 prev3d 好 且 roas < accountAvg → 10 |
| 漏斗錯配偵測 | 10 | CTR 正常/高但 CVR 低 (CTR > accountAvg 但 CVR < accountAvg*0.5) → 10 |
| 樣本不足但高花費 | 10 | impressions < 1000 且 spend > 200 → 10 |

**漏斗錯配偵測**：當 CTR 不差但 CVR 極低，表示問題可能在頁面而非廣告。此情況下：
- urgency 仍加分（需要處理）
- 但 diagnosis_type 設為 `landing_page_issue` 而非廣告問題
- stop_loss 判斷需排除此情況（見第六節）

#### 4.2.2 Account 的 Urgency Score

花費加權平均 + 修正：
- 有 critical 異常 → +20
- danger campaign 佔比 > 30% → +15
- GA4 結帳放棄率惡化 > 15% → +10

#### 4.2.3 Page 的 Urgency Score

| 因子 | 最大貢獻 | 計算 |
|------|---------|------|
| CVR 惡化幅度 | 25 | pctChange(cvr, cvrPrev) < -20% → 25, < -10% → 12 |
| 流量下降幅度 | 20 | pctChange(sessions, sessionsPrev) < -30% → 20, < -15% → 10 |
| 跳出率偏高 | 15 | bounceRate > 80% → 15, > 70% → 8 |
| 營收下降幅度 | 20 | pctChange(revenue, revenuePrev) < -30% → 20, < -15% → 10 |
| 流量大但轉換差 | 10 | sessions > 200 且 cvr < groupAvg * 0.3 → 10 |
| 加入購物車率惡化 | 10 | pctChange(atcRate, atcRatePrev) < -25% → 10 |

#### 4.2.4 Page Group 的 Urgency Score

流量加權平均 + 若 group 有 danger page 佔比 > 30% 則 +15。

---

### 4.3 Opportunity Score 機會分數 (0-100)

衡量「是否值得加碼投入」。

#### 4.3.1 Campaign / Ad Set / Ad 的 Opportunity Score

| 因子 | 最大貢獻 | 計算 |
|------|---------|------|
| ROAS 超越目標的空間 | 20 | headroom = roas_7d - roasTarget; score = clamp(headroom * 10, 0, 20) |
| 多窗口一致性 | 18 | 3d/7d/14d ROAS 的 CV < 0.15 → 18, < 0.25 → 12, < 0.4 → 6 |
| 頻率剩餘空間 | 12 | freqRoom = max(0, 3 - frequency); score = clamp(freqRoom * 4, 0, 12) |
| 花費佔比偏低但效率高 | 15 | spendShare < 10% 且 roas > accountAvg → 15, < 20% → 8 |
| CTR 優勢 | 10 | ctr / accountAvg > 1.3 → 10, > 1.1 → 6 |
| CVR 優勢 vs 同類 | 10 | cvr / peerAvg > 1.3 → 10, > 1.1 → 6 |
| 素材新鮮度 | 10 | frequency < 1.5 → 10, < 2.5 → 6, >= 2.5 → 2 |
| 已暫停但前期優秀 | 5 | status=PAUSED 且 prev ROAS > target 且 freq < 3 → 5 |

#### 4.3.2 Account 的 Opportunity Score

花費加權平均其下 campaign opportunity_score + 修正：
- 帳號整體 ROAS > target * 1.5 → +10
- 有 3+ 個 potential campaign → +8

#### 4.3.3 Page 的 Opportunity Score

| 因子 | 最大貢獻 | 計算 |
|------|---------|------|
| CVR 高但流量低 | 25 | cvr > siteAvg*1.5 且 sessions < 100 → 25 |
| CVR 高且跳出低 | 20 | cvr > siteAvg 且 bounceRate < siteAvg.bounceRate → 20 |
| 高流量中轉換 | 12 | sessions > 500 且 cvr > siteAvg*0.8 → 12 |
| 營收潛力 | 15 | 若 revenue / sessions 高於站內平均 → score |
| 加入購物車率高 | 13 | atcRate > groupAvg → 比例 * 13 |
| 流量成長趨勢 | 15 | pctChange(sessions, sessionsPrev) > 30% → 15, > 15% → 8 |

#### 4.3.4 Page Group 的 Opportunity Score

流量加權平均 + 若 group 有 3+ 個 potential page → +10。

---

### 4.4 Confidence Score 信心分數 (0-100)

衡量「這些分數可不可信」。

#### 4.4.1 Campaign / Ad Set / Ad 的 Confidence Score

| 因子 | 最大貢獻 | 條件 |
|------|---------|------|
| 曝光量 | 30 | impressions_7d >= 10000 → 30, >= 5000 → 22, >= 1000 → 12, >= 500 → 6, < 500 → 2 |
| 點擊量 | 20 | clicks_7d >= 500 → 20, >= 200 → 15, >= 50 → 10, >= 20 → 5, < 20 → 1 |
| 轉換量 | 20 | conversions_7d >= 30 → 20, >= 10 → 15, >= 5 → 10, >= 1 → 5, 0 → 0 |
| 投放天數 | 15 | 7d 有資料且 14d 有資料 → 15, 只有 7d → 10, 只有 3d → 5 |
| 窗口一致性 | 15 | 多窗口指標方向一致 → 15, 部分一致 → 8, 矛盾 → 2 |

#### 4.4.2 Page 的 Confidence Score

| 因子 | 最大貢獻 | 條件 |
|------|---------|------|
| 工作階段數 | 35 | sessions >= 500 → 35, >= 200 → 25, >= 50 → 15, >= 10 → 7, < 10 → 2 |
| 有轉換資料 | 25 | purchases > 0 → 25, addToCart > 0 → 15, otherwise → 3 |
| 比較期有資料 | 20 | sessionsPrev > 0 → 20, otherwise → 0 |
| 指標穩定性 | 20 | CVR 變化 < 30% → 20, < 60% → 12, otherwise → 4 |

#### 4.4.3 Account / Page Group 的 Confidence Score

取其下子元素 confidence_score 的中位數。

---

## 五、Ad Risk Score 廣告風險分數

Ad Risk Score 是 urgency + health 的加權變體，專門用來排序「哪個廣告最危險」。

```
ad_risk_score = (
  roas_deterioration   * 25% +   // 7d ROAS vs prev7d ROAS 惡化幅度
  spend_weight         * 20% +   // 花費佔帳號比例
  frequency_fatigue    * 15% +   // 頻率 > 3 開始加分
  funnel_mismatch      * 15% +   // CTR 正常但 CVR 極低 = 頁面問題
  cpc_spike            * 10% +   // CPC vs 帳號平均
  confidence_penalty   * 15%     // 低樣本扣分
)
```

### 各因子詳細計算

```
roas_deterioration:
  delta = pctChange(roas_7d, roas_prev7d)
  if delta < -50 → 25
  if delta < -30 → 20
  if delta < -20 → 15
  if delta < -10 → 8
  otherwise → 0

spend_weight:
  share = spend_7d / account_total_spend_7d
  if share > 0.3 且 roas < 1 → 20
  if share > 0.2 且 roas < 1.5 → 15
  if share > 0.1 且 roas < 2 → 10
  otherwise → 0

frequency_fatigue:
  if frequency >= 6 → 15
  if frequency >= 4 → 12
  if frequency >= 3 → 7
  if frequency >= 2 → 3
  otherwise → 0

funnel_mismatch:
  ctrRatio = ctr / accountAvg.ctr
  cvrRatio = cvr / accountAvg.cvr
  if ctrRatio > 0.8 且 cvrRatio < 0.3 → 15 (頁面問題)
  if ctrRatio > 0.8 且 cvrRatio < 0.5 → 10
  otherwise → 0

cpc_spike:
  ratio = cpc_7d / accountAvg.cpc
  if ratio > 2.0 → 10
  if ratio > 1.5 → 7
  if ratio > 1.2 → 3
  otherwise → 0

confidence_penalty:
  penalty = max(0, 15 - confidence_score * 0.15)
```

---

## 六、停損判斷 Stop-Loss

### 6.1 必要前提 (全部滿足才考慮停損)

1. **樣本門檻**：impressions_7d >= 1000 AND clicks_7d >= 30 AND spend_7d >= 100
2. **多窗口一致偏弱**：roas_3d < roasTarget AND roas_7d < roasTarget
3. **花費門檻**：spend_7d > max(500, accountDailyAvg * 3)
4. **非頁面主導問題**：`diagnosis_type !== "landing_page_issue"` (若 CTR 正常但 CVR 極低，先查頁面)

### 6.2 停損確認條件 (至少 4/6 滿足)

| 條件 | 計算 |
|------|------|
| ROAS 多窗口偏弱 | roas_7d < roasTarget AND roas_14d < roasTarget |
| 低於帳號平均 50% | roas_7d < accountAvg.roas * 0.5 |
| 低於同類型平均 | roas_7d < peerAvg.roas * 0.7 |
| 同帳號排名後 20% | ROAS 排名在同帳號 campaign 的後 20% |
| 近 3 天無改善 | roas_3d <= prev3d.roas * 1.05 |
| 花費效率極差 | spend_7d > accountAvg.spend * 2 且 roas_7d < 1 |

### 6.3 停損排除條件 (任一滿足則不停損)

- confidence_score < 30 (樣本不足，不做判斷)
- diagnosis_type === "landing_page_issue" 且 CTR > accountAvg (廣告本身沒問題)
- 近 1d ROAS > roasTarget * 1.2 (可能正在回升)
- status === "PAUSED" (已暫停的不重複停損)

### 6.4 StopLossResult 輸出結構

```
StopLossResult {
  shouldStop: boolean
  reasons: string[]             // 每條理由 (繁體中文)
  criteria: {
    sampleMet: boolean
    spendMet: boolean
    multiWindowMet: boolean
    vsAccountAvgMet: boolean
    vsPeerAvgMet: boolean       // 新增：vs 同類型平均
    bottomPercentileMet: boolean
    noImprovementMet: boolean
    notPageIssueMet: boolean    // 新增：排除頁面問題
  }
  confidenceNote: string        // "高信心" / "中信心" / "低信心，建議延長觀察"
}
```

---

## 七、Opportunity Board 機會看板

### 7.1 四種機會類型

| 類型 | 識別條件 |
|------|---------|
| low_spend_high_efficiency | spend < 帳號中位數, roas > accountAvg * 1.5, conversions > 0, confidence >= 40 |
| stable_scalable | 3d/7d/14d ROAS 的 CV < 0.15, frequency < 2.5, roas > roasTarget, confidence >= 50 |
| new_potential | impressions > 500, conversions > 0, roas > roasTarget, spend < 帳號中位數 * 0.5, confidence >= 30 |
| restartable | status = PAUSED, prev ROAS > roasTarget, frequency < 3, 未被停損 |

### 7.2 排除規則 (任一條即排除)

- spend = 0 且 impressions = 0
- roas = 0 且 impressions = 0
- risk_level = "danger"
- shouldStop = true
- confidence_score < 20
- status = "DELETED" 或類似已結束狀態
- 結束超過 30 天 (需要 end_time 欄位，若無法取得則不套用)

### 7.3 機會分數排序

使用 opportunity_score 排序，同分時 confidence_score 高的優先。

---

## 八、GA4 頁面評分三維

### 8.1 Page Health Score

見第 4.1.3 節。

### 8.2 Page Leakage Score 頁面漏斗流失分數 (0-100)

衡量「這個頁面造成多少漏斗流失」。分數越高，流失越嚴重。

| 因子 | 最大貢獻 | 計算 |
|------|---------|------|
| 跳出率 vs 站內平均 | 25 | excess = max(0, bounceRate - siteAvg.bounceRate); score = clamp(excess * 1.5, 0, 25) |
| 跳出率 vs 同 group 平均 | 10 | excess = max(0, bounceRate - groupAvg.bounceRate); score = clamp(excess * 1, 0, 10) |
| 加入購物車率低 | 15 | 若 pageGroup = products 且 atcRate < groupAvg.atcRate * 0.5 → 15 |
| 結帳率低 | 15 | 若 pageGroup = cart/checkout 且 checkoutRate < siteAvg → 15 |
| CVR 低於同 group | 15 | ratio = max(0, 1 - cvr / groupAvg.cvr); score = clamp(ratio * 30, 0, 15) |
| 營收流失估算 | 10 | 若 sessions 高但 revenue 低 → 估算流失營收比例 |
| 互動時間極短 | 10 | engTime < 10s → 10, < 20s → 6, < 30s → 3 |

特殊規則：
- 首頁 (homepage) 和部落格 (blogs) 的加入購物車率因子權重減半（這些頁面本來就不以直接轉換為主）
- 購物車 (cart) 和結帳 (checkout) 頁面的結帳率因子權重加倍

### 8.3 Page Opportunity Score

見第 4.3.3 節。

### 8.4 頁面分析維度

現有 `GA4PageMetricsDetailed` 需擴充：

```
GA4PageMetricsDetailed {
  // 既有
  pagePath, pageTitle, pageGroup, sessions, pageviews, avgEngagementTime,
  bounceRate, addToCart, beginCheckout, purchases, revenue, conversionRate,
  sessionsPrev, conversionRatePrev, revenuePrev, bounceRatePrev,
  
  // 新增
  landingPageSessions: number       // 作為 Landing Page 的工作階段數
  landingPageBounceRate: number     // 作為 Landing Page 的跳出率
  
  // 評分結果
  health_score: number
  urgency_score: number
  opportunity_score: number
  leakage_score: number
  confidence_score: number
  risk_level: RiskLevel
  primary_issue: string
  diagnosis_type: DiagnosisType
  recommended_action: string
  time_window_basis: string
  benchmark_basis: string
}
```

---

## 九、標準輸出格式

### 9.1 每個分析對象都必須輸出 ScoringResult

```typescript
interface ScoringResult {
  health_score: number;
  urgency_score: number;
  opportunity_score: number;
  confidence_score: number;
  risk_level: RiskLevel;
  primary_issue: string;
  diagnosis_type: DiagnosisType;
  recommended_action: string;
  time_window_basis: string;
  benchmark_basis: string;
}
```

### 9.2 primary_issue 與 diagnosis_type 決定邏輯

```
if health < 30 且 urgency >= 50:
  if CTR > accountAvg 且 CVR < accountAvg * 0.3:
    diagnosis_type = "landing_page_issue"
    primary_issue = "頁面承接問題：CTR 正常但轉換率極低"
  elif frequency > 4:
    diagnosis_type = "creative_fatigue"
    primary_issue = "素材疲勞：頻率 {freq}，受眾重複曝光嚴重"
  elif roas 惡化 > 30%:
    diagnosis_type = "bid_competition"
    primary_issue = "競價惡化：ROAS 從 {prev} 降至 {curr}"
  else:
    diagnosis_type = "budget_inefficiency"
    primary_issue = "效率低落：ROAS {roas}，低於帳號平均 {avg}"

elif confidence < 30:
  diagnosis_type = "sample_insufficient"
  primary_issue = "樣本不足：曝光 {imp}，尚不具統計意義"

elif health >= 70 且 urgency < 20:
  diagnosis_type = "healthy"
  primary_issue = "運作正常"

// 頁面特有
if pageGroup = "cart" 且 跳出率 > 60%:
  diagnosis_type = "funnel_leak"
  primary_issue = "購物車頁面流失嚴重：跳出率 {br}%"
```

### 9.3 recommended_action 規則

| diagnosis_type | health | urgency | recommended_action |
|----------------|--------|---------|-------------------|
| creative_fatigue | <40 | >50 | "立即更換素材或擴大受眾" |
| landing_page_issue | any | >40 | "優先檢查到達頁面，廣告暫維持" |
| bid_competition | <40 | >40 | "降低出價或縮小受眾範圍" |
| budget_inefficiency | <30 | >60 | "建議停損，轉移預算至高效活動" |
| funnel_leak | <50 | >30 | "優化頁面體驗，降低跳出率" |
| sample_insufficient | any | any | "延長觀察，待樣本累積" |
| healthy | >70 | <20 | "維持現狀，持續監控" |

### 9.4 time_window_basis 與 benchmark_basis

```
time_window_basis = "7d vs prev7d"  // 主要依據的窗口
  // 或 "3d+7d vs prev" 如果兩個窗口都確認了趨勢

benchmark_basis = "帳號平均 ROAS 2.3 / 同類型平均 ROAS 1.8"
  // 清楚列出與哪個基準比較
```

---

## 十、資料擷取擴充需求

### 10.1 Meta API 變更

**新增 Ad Set 級別擷取**：
```
GET /{act_id}/insights?level=adset&fields=adset_id,adset_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,frequency,actions,action_values
```

**新增 Ad 級別擷取**：
```
GET /{act_id}/insights?level=ad&fields=ad_id,ad_name,adset_id,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,frequency,actions,action_values
```

Multi-window 擷取邏輯（1d/3d/7d/14d + comparison）應套用至三個 level。

### 10.2 GA4 變更

**新增 Landing Page 報表**：
```
dimensions: ["landingPage"]
metrics: ["sessions", "bounceRate", "averageSessionDuration", "addToCarts", "ecommercePurchases", "purchaseRevenue"]
```

將 landingPage 資料合併至對應的 pagePath 記錄。

---

## 十一、Schema 變更摘要

### 新增類型

```typescript
type DiagnosisType = 
  | "creative_fatigue" | "audience_exhaustion" | "bid_competition"
  | "landing_page_issue" | "funnel_leak" | "tracking_issue"
  | "budget_inefficiency" | "seasonal_shift" | "sample_insufficient" | "healthy";

interface ScoringResult {
  health_score: number;
  urgency_score: number;
  opportunity_score: number;
  confidence_score: number;
  risk_level: RiskLevel;
  primary_issue: string;
  diagnosis_type: DiagnosisType;
  recommended_action: string;
  time_window_basis: string;
  benchmark_basis: string;
}
```

### 修改類型

```typescript
// CampaignMetrics 新增
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  objective?: string;        // campaign objective (用於同類型比較)
  scoring?: ScoringResult;   // 取代原本的 triScore + riskLevel

// GA4PageMetricsDetailed 新增
  landingPageSessions: number;
  landingPageBounceRate: number;
  leakage_score: number;
  scoring: ScoringResult;    // 取代原本的 triScore + riskLevel

// StopLossResult 修改
  criteria 新增: vsPeerAvgMet, notPageIssueMet
  新增: confidenceNote

// AnalysisBatch 新增
  adsetMetrics?: AdSetMetrics[];
  adMetrics?: AdMetrics[];
  pageGroupScoring?: Record<PageGroup, ScoringResult>;
```

### AdSetMetrics / AdMetrics 新類型

```typescript
interface AdSetMetrics {
  accountId: string;
  accountName: string;
  campaignId: string;
  adsetId: string;
  adsetName: string;
  // 同 CampaignMetrics 的數值欄位
  multiWindow?: MultiWindowMetrics;
  scoring?: ScoringResult;
  stopLoss?: StopLossResult;
}

interface AdMetrics {
  accountId: string;
  accountName: string;
  campaignId: string;
  adsetId: string;
  adId: string;
  adName: string;
  // 同 CampaignMetrics 的數值欄位
  multiWindow?: MultiWindowMetrics;
  scoring?: ScoringResult;
  stopLoss?: StopLossResult;
}
```

---

## 十二、實作計畫（待核准後執行）

| 步驟 | 內容 | 影響檔案 |
|------|------|---------|
| S1 | Schema 更新 — 新增 ScoringResult, DiagnosisType, AdSetMetrics, AdMetrics; 修改 CampaignMetrics, GA4PageMetricsDetailed, StopLossResult, AnalysisBatch | shared/schema.ts |
| S2 | Meta 資料擷取 — 新增 adset/ad 級別擷取函數; multi-window 支援三個 level | server/meta-data-fetcher.ts |
| S3 | GA4 資料擷取 — 新增 landingPage 維度報表; 合併至頁面資料 | server/ga4-data-fetcher.ts |
| S4 | 評分引擎重寫 — 實作完整 Health/Urgency/Opportunity/Confidence 四分數; Ad Risk Score; 停損重寫; 機會看板重寫 | server/scoring-engine.ts |
| S5 | 管線整合 — 更新 refresh pipeline 以串接 adset/ad 擷取 + 新評分引擎 | server/routes.ts |
| S6 | Transformer 更新 — 所有 transformer 使用 ScoringResult 而非 TriScore | server/real-data-transformers.ts |
| S7 | AI Prompt 更新 — 傳入完整 ScoringResult + diagnosis_type | server/ai-summary-pipeline.ts |
| S8 | 前端更新 — 替換 TriScore 顯示為 ScoringResult 四分數 + diagnosis + action | client/src/pages/*.tsx |

**S1-S4 為核心，S5-S7 為串接，S8 為展示層。依序實作，每步完成後編譯檢查。**
