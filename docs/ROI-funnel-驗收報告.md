# ROI-first + Funnel Health + Confidence 驗收報告

## 需求摘要

- **Lucky**：低預算運氣出單需辨識，不得直接判 Winner、不得直接加碼。
- **Winner**：須同時滿足 ROAS 達標 + 漏斗健康（ATC/Purchase rate 下界 ≥ baseline）+ 資料量 gate。
- **Underfunded**：高意圖（漏斗率高於 baseline）但 spend/clicks 不足，輸出可加碼任務。
- **FunnelWeak**：漏斗不健康（LB 低於 baseline）。
- 所有分類輸出 **label + qualityScore + confidenceLevel**，並回傳證據（rate、LB、baseline、gate）。

## 實作項目

| 項目 | 狀態 |
|------|------|
| Wilson lower bound（z=1.645）atc_lb / purchase_lb | ✅ |
| Baseline 商品 30 天彙總（不足 fallback 全站） | ✅ |
| 分類邏輯 Lucky / Winner / Underfunded / FunnelWeak | ✅ |
| Thresholds 擴充（minClicks/minATC/minPurchases/minSpend、funnel、lucky） | ✅ |
| GET /api/dashboard/creative-lifecycle 擴充（items、label、qualityScore、evidence、?label=） | ✅ |
| GET /api/dashboard/scorecard 擴充（luckyRate、funnelPassRate、avgQualityScore） | ✅ |
| GET /api/dashboard/replacement-suggestions（priority、Lucky/Underfunded action） | ✅ |
| UI 生命週期卡片 + label filter（含 Lucky） | ✅ |
| 設定中心門檻 publish/rollback | ✅ |

## 四組驗收 Case 與結果

執行：`npx tsx script/roi-funnel-acceptance.ts`

| Case | 預期 Label | 實際結果 | 通過 |
|------|------------|----------|------|
| **Lucky** | Lucky | 低預算(200)、少 clicks(30)、僅 1 次購買 → 辨識為運氣單 | ✅ 通過 |
| **Underfunded** | Underfunded | 漏斗率 ≥ baseline、ROAS 達標，spend(250)/clicks(80) 未達門檻 → 可加碼 | ✅ 通過 |
| **Winner** | Winner | ROAS 達標 + 漏斗健康 + 資料量 gate 通過 | ✅ 通過 |
| **FunnelWeak** | FunnelWeak | atc_lb / purchase_lb 低於 baseline，漏斗不健康 | ✅ 通過 |

**總計：4 通過，0 失敗。**

## 測試 Case 參數摘要

- **Lucky**：spend=200, clicks=30, atc=2, purchases=1, roas=4 → 不得判 Winner。
- **Underfunded**：spend=250, clicks=80, atc=10, purchases=4, roas=3 → 高意圖、預算不足。
- **Winner**：spend=600, clicks=120, atc=15, purchases=6, roas=3 → 達標且 gate 通過。
- **FunnelWeak**：spend=800, clicks=100, atc=1, purchases=0 → 漏斗 LB 低於 baseline。

## 相關檔案

- `shared/roi-funnel-engine.ts`：Wilson LB、baseline、分類、getSuggestedAction
- `server/routes.ts`：creative-lifecycle、scorecard、replacement-suggestions 擴充
- `client/src/pages/creative-lifecycle.tsx`：卡片、label filter
- `client/src/pages/settings-thresholds.tsx`：ROI 門檻欄位
- `server/workbench-db.ts`：DEFAULT_THRESHOLD_CONFIG 擴充
- `script/roi-funnel-acceptance.ts`：4 case 驗收腳本
