# Phase 2A：Guardrails／防污染／契約落地 — 交付回報

**對齊**：`docs/華麗熊-總監操盤系統-最終整合版.md` v1.4、`docs/phase1-runtime-pollution-audit.md`  
**本輪目標**：六大 Guardrails 落地，首頁／商品／素材核心區變可信；不做法定首頁五區美術重做。

---

## 0. Phase 2A 三點明確承認（不粉飾）

以下三點為事實陳述，不做模糊表述：

**1. batchValidity 的 legacy 目前仍屬規格先占位，尚未真正與 valid 嚴格區分。**

- 目前實作中，`getBatchValidity()` 僅在「無 batch／無 summary／無 campaignMetrics 或 length===0」時回傳 `insufficient`，其餘有基本結構即回傳 `valid`。
- `legacy`（舊版 batch、缺新欄位僅供參考）的判定條件尚未與 `valid` 嚴格分開，程式裡 legacy 與 valid 實質共用同一條件，屬先占位。
- **實際較完整可用的只有 valid 與 insufficient。**

**2. evidenceLevel 目前是首頁核心決策區先落地，不可表述成全站已完整統一。**

- evidenceLevel 已落於 action-center 回傳的 budgetActionTable、productLevelWithRule、creativeLeaderboard，以及 dashboard 首頁決策表與 Badge。
- 商品主戰場獨立頁、素材作戰台獨立頁、成功率頁、審判官輸出等，尚未全面帶入 evidenceLevel 或統一呈現方式。
- **因此不得宣稱「全站 evidenceLevel 已完整統一」，僅能說「首頁核心決策區已先落地」。**

**3. 首頁目前是「先變可信」，不是「首頁已完成」或「總監晨會桌面已完成」。**

- Phase 2A 達成的是：核心區不混入花費 0／樣本不足／未分類／成本缺失誤判，帳號降權，evidenceLevel 與 batch 有效性標示上線。
- 首頁尚未改為固定五區骨架（今日最該動 5 件事、主力商品戰情、高預算危險、黑馬素材、操作節制提醒），也尚未以「一句總監判語」為主體。
- **故首頁狀態為「先變可信」，總監晨會桌面與首頁五區正式重做留待 Phase 2B 完成。**

---

## 1. 完成狀態

| 項目 | 狀態 |
|------|------|
| 花費 0／no_delivery／under_sample 排除 | **完成** |
| 成本比缺失降級 | **完成** |
| evidenceLevel 落地 | **完成** |
| account 主視角降級 | **完成** |
| product mapping／未分類 guardrail | **完成** |
| latest valid batch 規則 | **完成** |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `shared/schema.ts` | 新增 EvidenceLevel 型別與常數（ads_only, ga_verified, rules_missing, insufficient_sample, no_delivery）、EVIDENCE_LEVEL_LABELS、BatchValidity 型別（valid, legacy, insufficient） |
| `shared/batch-validity.ts` | **新增**。getBatchValidity(batch) 回傳 validity + reason；insufficient＝無 batch／無 summary／無 campaignMetrics；legacy＝結構不完整；valid＝具備基本結構 |
| `server/routes.ts` | action-center：budgetActionTable 每列加 evidenceLevel；成本缺失時 suggestedAction 降為「待補規則」、reason 降級；budgetActionDecisionReady 僅保留 dataStatus===decision_ready；新增 budgetActionNoDelivery、budgetActionUnderSample；creativeLeaderboard 加 evidenceLevel、過濾 under_sample、未分類排最後、creativeLeaderboardUnderSample；productLevelWithRule 加 evidenceLevel；回傳 batchValidity、batchValidityReason、budgetActionNoDelivery、budgetActionUnderSample、creativeLeaderboardUnderSample。cross-account-summary：回傳 batchValidity、batchValidityReason。import getBatchValidity、EVIDENCE_*、EvidenceLevel |
| `client/src/pages/dashboard.tsx` | 新增 EVIDENCE_LABELS；ActionCenterData 與 BudgetActionRow 加 batchValidity、evidenceLevel、budgetActionNoDelivery、budgetActionUnderSample、creativeLeaderboardUnderSample；summaryData query 加 batchValidity；首屏加 batch 有效性橫幅（legacy／insufficient）；加「待驗證區」說明行；決策表三處加 evidenceLevel Badge；ADMIN 區塊改為 Collapsible「報表與帳號（次級）」defaultOpen=false |

---

## 3. 各 Guardrail 如何落地

### Guardrail 1：核心區排除規則

- **後端**：`/api/dashboard/action-center`。budgetActionDecisionReady 改為只保留 `dataStatus === DATA_STATUS_DECISION_READY`（排除 no_delivery、under_sample）。budgetActionNoDelivery、budgetActionUnderSample 另存供次級／待驗證區。creativeLeaderboard 核心榜排除 `evidenceLevel === EVIDENCE_INSUFFICIENT_SAMPLE`，未分類商品排最後；creativeLeaderboardUnderSample 另回傳。productLevelMain 維持只含 spend>0 且 productName!=='未分類'。
- **前端**：決策表（今日先救／可加碼／維持）僅用 tableRescue、tableScaleUp、tableNoMisjudge（皆來自 budgetActionDecisionReady）。顯示「尚有 X 筆未投遞、Y 筆樣本不足，已移至待驗證區」。
- **缺資料時**：no_delivery／under_sample 列在 budgetActionNoDelivery、budgetActionUnderSample，前端可於次級區顯示或僅顯示計數說明。
- **排除出核心區**：花費 0、no_delivery、under_sample、創意榜樣本不足；未分類仍在 productLevelUnmapped／productLevelNoDelivery，不進 productLevelMain。

### Guardrail 2：成本比缺失降級規則

- **後端**：action-center 建 budgetActionTable 時，若 `!hasRule` 且引擎建議為「可加碼」或「高潛延伸」，改為 suggestedAction＝「待補規則」、reason＝「成本規則未補齊，暫不建議高信心判賺錢／可放大」。tableScaleUp 維持只含 `hasRule === true`。
- **前端**：沿用 costRuleStatus「待補成本規則」、(待補規則) 標示；evidenceLevel 為 rules_missing 時顯示「規則缺失」Badge。
- **不進主力區**：tableScaleUp 已濾 hasRule；productLevelMain 未單獨濾 hasRule，但「今天誰最賺錢」卡只顯示 hasRule 且 roas>=1。

### Guardrail 3：evidenceLevel 正式落地

- **後端**：budgetActionTable 每列設 evidenceLevel（no_delivery / insufficient_sample / rules_missing / ads_only）。creativeLeaderboard 每列設 evidenceLevel（confidenceScore<40 為 insufficient_sample，否則 ads_only）。productLevelWithRule 每列設 evidenceLevel（未分類或無規則為 rules_missing，花費 0 為 no_delivery，其餘 ads_only）。
- **前端**：決策表三表（今日先救、可加碼、維持）在活動／商品名稱旁顯示 EVIDENCE_LABELS[evidenceLevel] Badge。漏斗卡已有「目前無漏斗資料，以下僅為廣告層推測」。
- **語氣／信心**：規則缺失、樣本不足、尚未投遞以 Badge 標示，不包裝成機會；無 GA 時 funnelEvidence=false，漏斗卡已標廣告層推測。

### Guardrail 4：首頁主角先校正

- **前端**：ADMIN 專區（HeroSummaryCard、TopPriorityAccountsSection、AccountRankingTable、OpportunitySummaryCard、RiskyCampaignsSection、AnomalySummarySection、BoardsSection、AIRecommendationsSection）改為收合於 Collapsible「報表與帳號（次級）」、defaultOpen=false。決策焦點四問與今日先救／可加碼等表維持在收合區之上，核心視線先給動作／商品／風險／機會。

### Guardrail 5：未分類與歸屬不明處理

- **後端**：productLevelMain 排除 productName==='未分類'。productLevelUnmapped、productLevelNoDelivery 分開回傳。creativeLeaderboard 排序將 productName==='未分類' 排最後。
- **前端**：沿用 productLevelMain、productLevelNoDelivery、productLevelUnmapped；未分類不進「今天誰最賺錢」等核心卡（已用 productLevelMain／hasRule 過濾）。

### Guardrail 6：latest valid batch 規則

- **後端**：`shared/batch-validity.ts` getBatchValidity(batch)。valid＝有 summary、campaignMetrics 且 length>0、結構完整。insufficient＝無 batch／無 summary／無 campaignMetrics 或 length===0。legacy＝有資料但結構不完整（目前與 valid 共用條件，可日後擴充）。action-center、cross-account-summary 回傳 batchValidity、batchValidityReason。
- **前端**：batchValidity===`legacy` 或 `insufficient` 時顯示橫幅：「資料不足，請先更新資料…」或「目前為舊版資料僅供參考…」，並可顯示 reason。

---

## 4. latest valid batch 規則（明文化）

| 狀態 | 條件 | 前台處理 |
|------|------|----------|
| **valid** | batch 存在、batch.summary 存在、batch.campaignMetrics 為陣列且 length>0、具備基本結構 | 正常顯示決策區與表；可進核心區 |
| **legacy** | 有 batch 但結構不完整（目前實作與 valid 共用，預留擴充） | 橫幅「舊版資料僅供參考」，核心決策以決策焦點與表為準 |
| **insufficient** | 無 batch／無 summary／campaignMetrics 空或不存在 | 橫幅「資料不足，請先更新資料」；不依此 batch 做核心決策 |

---

## 5. 前台污染還剩哪些沒解

- **高預算危險排序**：尚未依「影響力」重排，仍以既有 riskyCampaigns／tableRescue 排序為主；Phase 2B 可補影響力排序。
- **1d／3d／7d 邏輯**：已存在於 API，前台部分區塊未完整顯示多窗口趨勢；可於 Phase 2B 統一呈現。
- **成功率頁「未進決策點」vs「0 成功率」**：scorecard 尚未標示定義待補／僅供參考；Phase 2 或 3 補齊。
- **workflow 切換是否真行為**：審判官 workflow 已有後端切換，空狀態／輸出骨架是否逐 workflow 完整切換需逐項驗收；未在本輪實作。
- **商品主戰場／素材作戰台**：本輪以 action-center 與 dashboard 為主，獨立商品頁、素材生命週期頁的 core/secondary 分區與 evidenceLevel 可再強化（部分已透過 API 回傳）。

---

## 6. 靈魂不流失檢查（Phase 2A 版）

- **本輪新增 guardrail 文案**：橫幅為「資料不足，請先更新資料」「目前為舊版資料僅供參考」；待驗證區為「尚有 X 筆未投遞、Y 筆樣本不足，已移至待驗證區」；成本缺失為「成本規則未補齊，暫不建議高信心判賺錢／可放大」。皆為直接、不裝懂、符合 §41 資料不足／規則缺失收斂。
- **尚未接入總監語言層的區塊**：決策表仍以數字與 reason 為主，尚未接「一句總監判語」與完整 §41 節奏；橫幅與 Badge 為狀態標示，非總監判語，故不宣稱有總監味道。
- **是否有退化成普通 AI／報表語氣**：無。未使用「建議觀察」「可能可以考慮」等禁用句型；降級說明皆明確標示規則缺失／資料不足／廣告層推測。
- **can proceed**：**can proceed**。

---

## 7. 是否可進 Phase 2B

| 檢查項 | 結果 |
|--------|------|
| 首頁核心區現在可信嗎 | 是。核心表僅 decision_ready；花費 0／樣本不足已排除並有去處；成本缺失已降級。 |
| 花費 0／樣本不足／未分類是否已不再污染核心區 | 是。budgetActionDecisionReady 僅 decision_ready；creativeLeaderboard 排除 under_sample；未分類不進 productLevelMain、創意榜排最後。 |
| 成本比缺失是否已不再誤判 | 是。無規則時不顯示高信心可加碼；tableScaleUp 僅 hasRule；建議改為「待補規則」+ 說明。 |
| evidenceLevel 是否已真的進前台 | 是。決策表三表顯示 evidenceLevel Badge；橫幅與漏斗卡已標資料不足／廣告層推測。 |
| 首頁主角是否已足以進一步改成五區 | 是。帳號區已收合為「報表與帳號（次級）」；決策焦點與表優先。 |
| **can proceed** | **can proceed**。可進入 Phase 2B 首頁五區正式重做。 |

---

## 8. Commit hash

- **程式**：請於本輪修改完成後自訂 commit（例：`feat(phase2a): guardrails, evidenceLevel, batch validity, account demote`）。
- **文件**：本文件 `docs/phase2a-guardrails-report.md` 請一併 commit（例：`docs: Phase 2A guardrails delivery report`）。

---

**文件版本**：Phase 2A 交付 v1  
**對齊**：華麗熊-總監操盤系統-最終整合版 v1.4、Phase 2A 執行要求與回報格式。
