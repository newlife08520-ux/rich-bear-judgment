# 本輪修訂：資料潔淨 + 成本規則 + 證據化 — 回報

## 1. 問題根因拆解

| 問題 | 根因 | 本輪處理 |
|------|------|----------|
| 資料可信度不足 | 花費 0、未投遞、樣本不足的資料混入核心決策表／黑榜／商品排行；漏斗無資料卻用確診式語氣；商品未分類污染排行 | 統一定義 no_delivery / under_sample / decision_ready；核心表僅含花費>0 且非 no_delivery；可加碼表僅含已設定成本規則；漏斗無資料時 funnel_evidence=false 並降級文案；未分類拆到 productLevelUnmapped |
| 判斷不可解釋 | 1d/3d/7d、保本、目標、Headroom、ATC/Purchase 未在決策表與摘要卡呈現 | API 回傳 breakEvenRoas、targetRoas、roas1d/3d/7d、profitHeadroom、addToCart、conversions、dataStatus、costRuleStatus；決策表與摘要卡補齊上述欄位 |
| 產品獲利規則非一等公民 | 未區分「已設定成本比」與「使用預設／未設定」；未設定者仍被高信心判賺錢/可加碼 | getProductProfitRuleExplicit 區分是否已寫入規則；tableScaleUp 僅含 hasRule===true；首頁「今天誰在賺錢」僅顯示 hasRule 且 ROAS≥1；待補成本規則標記並可跳獲利規則中心 |

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `server/profit-rules-store.ts` | 新增 getProductProfitRuleExplicit(productName)，未設定回傳 null |
| `shared/schema.ts` | 新增 DATA_STATUS_NO_DELIVERY / UNDER_SAMPLE / DECISION_READY、DataStatus 型別 |
| `shared/funnel-stitching.ts` | runFunnelDiagnostics(rows, options?: { funnelEvidence?: boolean })；funnelEvidence 為 false 時改用廣告層推測語氣，不作漏斗定罪 |
| `server/routes.ts` | action-center：getDataStatus；budgetActionTable 每筆補 hasRule、costRuleStatus、breakEvenRoas、targetRoas、roas1d/3d/7d、addToCart、conversions、dataStatus；budgetActionDecisionReady 過濾 spend>0 且非 no_delivery；tableScaleUp 僅 hasRule===true；tableRescue/tableNoMisjudge 同用 decisionReady；riskyCampaigns 過濾 spend>0；creativeLeaderboard 改為 creativeRawDecisionReady（spend>0）；productLevelWithRule、productLevelMain、productLevelNoDelivery、productLevelUnmapped、unmappedCount；funnelEvidence=false、runFunnelDiagnostics(..., { funnelEvidence }) |
| `client/src/pages/dashboard.tsx` | BudgetActionRow 與 ActionCenterData 型別擴充證據欄位與 funnelEvidence、productLevelMain/NoDelivery/Unmapped；摘要卡「今天誰在賺錢」僅 hasRule 且 ROAS≥1；「今天誰最危險」優先 tableRescue 並顯示花費/ROAS/BE/Headroom/建議；「今天誰最值得放大」優先 tableScaleUp 並顯示 ROAS/BE/目標/Headroom/1d3d7d/原因；漏斗區塊 funnelEvidence===false 時顯示免責聲明；決策表（先救/可加碼/不要誤判）新增欄位 1d3d7d、保本、目標、Headroom、ATC/Purchase、樣本、costRuleStatus |
| `client/src/pages/products.tsx` | 使用 productLevelMain 做核心列表；rows 補 hasRule、costRuleStatus；表頭新增「成本規則」欄，未設定可點擊跳獲利規則中心；Collapsible「未投遞／未映射」區塊（productLevelNoDelivery、productLevelUnmapped、unmappedCount） |
| `client/src/pages/judgment.tsx` | 空狀態改兩層：1. 我要做什麼（審判/產出/策略/任務）→ 2. 選擇類型（依 workflow 篩選 EMPTY_ENTRIES）；子類型含 placeholder、emptyTitle、emptySubtitle；selectedSubtype 驅動標題、副標、輸入提示 |

## 3. 成本比／獲利規則如何落地

- **沿用現有獲利規則中心**：未新起第二套；`server/profit-rules-store.ts` 與 `client/src/pages/settings-profit-rules.tsx` 不變，僅補「是否已設定」查詢。
- **getProductProfitRuleExplicit(productName)**：回傳已寫入規則或 null；前端與 action-center 用此區分「待補成本規則」與「已設定」。
- **決策表**：tableScaleUp 僅納入 `hasRule === true` 的活動，故未設定成本比的商品不會被高信心判為可加碼／值得放大。
- **首頁「今天誰在賺錢」**：只顯示 `productLevelMain` 中 `hasRule && roas >= 1` 的商品。
- **商品作戰室**：每列顯示成本規則狀態（已設定／未設定·點此設定），未設定可點擊連到 `/settings/profit-rules`。

## 4. 花費 0／無投遞／樣本不足如何排除或降級

- **三類狀態**：`no_delivery`（花費 0 或 impressions 0）、`under_sample`（有花費但信心<40）、`decision_ready`（可判讀）；由 getDataStatus(spend, impressions, confidenceScore) 計算。
- **核心決策表**：tableRescue、tableScaleUp、tableNoMisjudge 僅來自 `budgetActionDecisionReady`（spend>0 且 dataStatus !== no_delivery）。
- **可加碼表**：再篩選 hasRule===true，故未設定成本規則者不會進「今日可加碼」。
- **創意榜**：creativeLeaderboard 改為僅含 spend>0（creativeRawDecisionReady），金榜/黑榜不混入未投遞。
- **riskyCampaigns**：僅回傳 spend>0 的活動。
- **商品層**：productLevelMain = 花費>0 且 productName !== "未分類"；productLevelNoDelivery、productLevelUnmapped 分開回傳，前端可折疊顯示「未投遞／未映射」。

## 5. 首頁摘要卡如何補強

- **今天誰最危險**：優先使用 tableRescue 前 3 筆；每筆顯示活動/商品、花費、ROAS、保本 ROAS、Headroom、建議動作與幅度；無 tableRescue 時退回原 productLevel 低 ROAS 列表。
- **今天誰最值得放大**：優先使用 tableScaleUp 前 5 筆；每筆顯示 ROAS、保本/目標 ROAS、Headroom、1d/3d/7d 趨勢、原因；無 tableScaleUp 時退回 creativeLeaderboard Winner/Potential。
- **今天誰在賺錢**：僅顯示已設定成本規則且 ROAS≥1 的商品（hasRule && roas >= 1）。

## 6. 決策證據欄位如何補齊

- **API**：budgetActionTable 每筆含 breakEvenRoas、targetRoas、roas1d/3d/7d、profitHeadroom、addToCart、conversions、dataStatus、sampleStatus、hasRule、costRuleStatus。
- **今日先救／今日可加碼／今日不要誤判**：桌機版表格新增欄位 1d/3d/7d、保本、目標、Headroom、ATC/Purchase、樣本、成本規則狀態；手機版以 `hidden lg:table-cell` 摺疊部分欄位。

## 7. 漏斗無資料時如何降級

- **funnel_evidence**：action-center 回傳 `funnelEvidence: false`（目前 GA4 為 Mock，無真實漏斗）。
- **runFunnelDiagnostics(rows, { funnelEvidence })**：當 funnelEvidence 為 false，落地頁破口與結帳阻力改用「廣告層推測…目前無漏斗資料，不作漏斗定罪」語氣，不再使用「請立即檢查…」「結帳失敗流失…」等確診式文案。
- **前端**：漏斗診斷區塊當 `funnelEvidence === false` 時顯示：「目前無漏斗資料，以下僅為廣告層推測，不作漏斗定罪。」

## 8. 商品映射／未分類怎麼處理

- **來源**：商品名由 resolveProductWithOverrides(row, overrides, parseCampaignNameToTags(name)?.productName) 解析，無則 "未分類"。
- **核心排行**：productLevelMain = productLevel 過濾 spend>0 且 productName !== "未分類"，商品作戰室主表與首頁「誰在賺錢」使用 productLevelMain。
- **未映射區塊**：API 回傳 productLevelUnmapped、productLevelNoDelivery、unmappedCount；商品作戰室以 Collapsible 顯示「未投遞／未映射：N 商品無花費 · M 活動未映射」與建議修正命名或建立映射。

## 9. 審判官入口如何修正成真 workflow 感

- **兩層結構**：第一層「我要做什麼」— 審判 / 產出 / 策略 / 任務（對應 workflow）；第二層「選擇類型」— 依目前 workflow 篩選 EMPTY_ENTRIES（如 audit → 素材審判、廣告數據審判、GA4 漏斗審判；create → 商品頁審判）。
- **切 workflow 時一併變更**：子類型含 placeholder、emptyTitle、emptySubtitle；選定子類型後標題/副標/空狀態說明/輸入提示依 selectedSubtype 更新，不再只是固定一句提示詞。

## 10. Staging 驗收方式

1. **獲利規則**：至獲利規則中心設定某商品成本比；未設定商品在首頁「今天誰在賺錢」不出現、在「今日可加碼」不出現；商品作戰室該商品顯示「未設定·點此設定」並可跳轉。
2. **資料潔淨**：建立一筆花費 0 的活動，確認不出現在今日先救/可加碼/不要誤判與創意榜核心列表；確認 riskyCampaigns 僅 spend>0。
3. **證據**：今日先救/可加碼/不要誤判表可見 1d/3d/7d、保本、目標、Headroom、ATC/Purchase、樣本、成本規則狀態（桌機）；首頁「今天誰最危險」「今天誰最值得放大」可見 ROAS、保本、Headroom、建議。
4. **漏斗**：漏斗診斷區顯示「目前無漏斗資料…不作漏斗定罪」；診斷文案為廣告層推測語氣。
5. **未分類**：商品作戰室主表無「未分類」；折疊區可見未映射活動數與建議。
6. **審判官**：空狀態先選「審判」再選「素材審判」等，標題/副標/輸入提示隨類型變化。

## 11. Commit hash

（請於本輪 commit 後填寫）

---

*本輪未改：deployment / railway / .env / docs 僅新增本回報；成功率頁與素材工廠頁降噪說明依規格本輪不要求大重構，僅確保不亂判、不卡核心決策。*
