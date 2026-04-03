# 04 — DATA FLOW AND DECISION ENGINES

## 端到端資料流（語意）

1. 使用者設定（FB token、GA4、帳戶選取）進入 session。  
2. Refresh job 取得 batch，寫入 storage（Phase2 驗收核心）。  
3. Precompute 可寫入 action-center／scorecard 快取；verify:precompute 守結構與一致。  
4. build-action-center-payload 依 scope 過濾後輸出 `/api/dashboard/action-center`。  
5. cross-account-summary 另線建首頁摘要與 homepageDataTruth。  
6. Dashboard 合併五區、truth、dormant、次級摺疊。

## 首頁資料真相

- `dataStatus` 與 `homepageDataTruth` 不同欄，UI 須並陳且可辯護。  
- **partial**：主決策五區與沉睡仍可用；摘要敘事可能晚到。  
- **no data**：與 partial 不同，不可文案混用。

## Visibility policy 與 0 spend

- `shared/visibility-policy.ts` 為桶別與門檻單一來源。  
- 0 spend **不可**全隱藏，否則 no_delivery／under_sample 等診斷被吃掉。

## Dormant candidates

- 與 action-center 同源批次為目標；含 visibilityTier、revivalPriorityScore、復活建議等。  
- **非**單一 ROAS 排序。

## Decision cards / Goal pacing / Pareto

- Decision cards：營運卡結構；Focus 只取子集。  
- Goal pacing：觀察窗、調整敘事；對齊 Threshold 版本。  
- Pareto：多層級與 command UI；verify-b29 等守門。

## Scoring / ROI funnel

- scoring-engine、analysis-engine 產分數與風險。  
- `test:roi-funnel` 與儀表板卡片可能不同步，審查分開驗。

## 為何不是只看 ROAS

需同時處理：暫停贏家、partial、0 spend 診斷、指揮序；單 ROAS 會系統性漏驗。

## First version 區

- Tier C/D 擷取、Publish 產品化、CI 歸因完整度、routes 文件化。
