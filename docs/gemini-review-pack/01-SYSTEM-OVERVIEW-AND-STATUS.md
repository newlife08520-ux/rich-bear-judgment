# 01 — SYSTEM OVERVIEW AND STATUS

## 一句話定位

**Rich Bear／審判官**是一套以 **Meta／GA4 實際投放與網站資料** 為輸入、以 **規則引擎 + 預計算 action-center + AI 審判工作台** 為核心的 **營運決策層（decision layer）**——目標是讓營運者在 **首頁／商品／預算／創意／審判** 之間有一致的「今日先做什麼、信不信任、怎麼下手」，而不是另一份僅有 ROAS 排序的報表。

## 整體成熟度（客觀）

- **完成度（粗估）**：約 **72%**（相對「可長期給真實團隊每日閉環操作、且技術債低到可放心改」的願景）。  
- **100 分制評分**：**72 / 100**。  

### 為什麼不是更高分

1. **單體巨型後端／schema**：`server/routes.ts`、`shared/schema.ts` 仍過大，改動連鎖與審查成本高。  
2. **Publish／部分路由仍 placeholder 或 foundation**：與「完整商業 publish 闭环」仍有距離。  
3. **Truth pack 仍以 Tier B（seeded-runtime）為主**；Tier C／D 多為契約／placeholder，**外部審查不能當 production 真值**。  
4. **UX 仍有多表面、多層折疊**：首頁已往 war-room 收斂，但「15 秒內零困惑」仍非全站成立。  
5. **AI 與規則邊界**：結構化輸出、護欄、對齊已落地，但 **錯誤判斷／邊界案例** 仍須持續用真實帳戶驗。

### 最關鍵剩餘 5 個問題

1. **routes／schema 拆分與邊界測試**能否在不大破壞下持續推進。  
2. **partial data vs no data vs summary 晚到** 在全站文案與 API 是否 100% 一致。  
3. **0 spend／dormant／no_delivery** 分桶是否在每個表面（首頁／商品／FB／CI）語意零歧義。  
4. **Execution／Meta 真寫入** 的權限、失敗重試、與 UI 預期是否對齊。  
5. **審查包／manifest／generatorVersion／phase** 長期是否維持單一真相（已對齊 batch15_9，但需流程化）。

## 主功能成熟度速覽

| 區域 | 成熟 | First version / Partial | 明顯未完成 |
|------|------|-------------------------|------------|
| 首頁 Dashboard + command v12 | ✓ 方向正確、有 verify | 離「終局 war-room」仍有距離 | — |
| Judgment Focus/Operator | ✓ 分工清楚 | Operator 深度仍重 | — |
| Products 工作台 | ✓ | 與全站 scope／排序邊界 | — |
| FB Ads | ✓ | Meta gate／多 tab 認知負載 | — |
| GA4 | ✓ 分析頁存在 | 與首頁／judgment 敘事對齊度 | — |
| Creative Intelligence | ✓ 主鏡頭／標籤／Pareto | 版本歸因／queue「完整產品化」 | 部分構想未落地 |
| Assets／Creatives | ✓ | 與 publish／execution 交界 | — |
| Tasks | ✓ | 與 execution 闭环 | — |
| Settings（閾值／prompt／規則） | ✓ | — | — |
| Publish | foundation | placeholder 頁 | 完整商業 publish |

## Phase 與審查包真實狀態

- **phaseLabel**：`phase-batch15_9-complete`（`REVIEW-PACK-MANIFEST.json`）。  
- **generatorVersion**：`batch15_9`（與 phase 對齊）。  
- **主驗收鏈**：`verify:product-restructure`、`verify:release-candidate`、`create-review-zip:verified`（見 `docs/active/VERIFY-CHAIN-CANONICAL-MAP.md`）。  
- **Reviewer trust**：ZIP 內含 `create-review-zip-verified.txt`（exit=0）、manifest、contents、VERIFY-FULL-OUTPUTS；**風險**在於擷取多為 Tier B，審查者必須會讀 tier 標籤。

## 對外審查應如何理解本系統

這**不是**「接 GA4 當報表」或「聊天問 ROAS」的產品；而是 **(1) 資料同步與批次 (2) 規則與引擎產出決策信號 (3) UI 分層呈現 (4) 可選的 AI 審判與 (5) 受閘門保護的 Meta 操作** 的組合。若只審 UI 或只審 prompt，會 **嚴重低估或誤判** 真實風險。
