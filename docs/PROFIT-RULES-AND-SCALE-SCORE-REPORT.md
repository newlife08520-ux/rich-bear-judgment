# 獲利規則中心 + 趨勢預算引擎 — 回報

## 1. 問題拆解

| 問題 | 說明 |
|------|------|
| 只做榜單 | 缺乏依成本、目標淨利與趨勢的可執行預算建議 |
| 黑箱分數 | 分數未對應保本/目標 ROAS 與樣本門檻 |
| 預算動作不明 | 缺少「先降/小降/維持/可加碼/高潛」與建議幅度、原因 |
| 趨勢未分類 | 未區分假強型(A)、延遲型好貨(B)、可拉升型(C) |
| ATC 與購買混用 | 未拆成意圖量(ATC)與轉換效率(ATC→Purchase) |
| 8:2 未三層化 | 未明確區分養帳號主力、普通高潛素材、噪音 |

## 2. 實際修改檔案

| 檔案 | 變更 |
|------|------|
| `shared/schema.ts` | 新增 ProductProfitRule、DEFAULT_PROFIT_RULE、breakEvenRoas()、targetRoas() |
| `shared/scale-score-engine.ts` | **新建**：Scale Score 1–100（獲利/趨勢/漏斗/影響/信心）、getBudgetAction、getTrendABC |
| `server/profit-rules-store.ts` | **新建**：getProductProfitRules、getProductProfitRule、setProductProfitRule（.data/product-profit-rules.json） |
| `server/routes.ts` | GET/PUT /api/profit-rules、GET /api/profit-rules/calculations；action-center 回傳 budgetActionTable、tierMainAccount、tierHighPotentialCreatives、tierNoise；創意/活動帶 scaleScore、suggestedAction、suggestedPct、budgetReason |
| `client/src/pages/settings-profit-rules.tsx` | **新建**：獲利規則中心頁（成本比、目標淨利率、樣本門檻、自動保本/目標 ROAS） |
| `client/src/App.tsx` | 路由 /settings/profit-rules |
| `client/src/pages/settings.tsx` | 連結「獲利規則中心」 |
| `client/src/components/app-sidebar.tsx` | 工具區新增「獲利規則中心」 |

## 3. 獲利規則中心設計

- **每商品可設定**：成本比、目標淨利率、最小花費、最小點擊、最小 ATC、最小 Purchase。
- **自動計算**：
  - 保本 ROAS = 1 / (1 - 成本比)
  - 目標 ROAS = 1 / (1 - 成本比 - 目標淨利率)
- **儲存**：`.data/product-profit-rules.json`，key 為商品名稱；未設定商品使用 DEFAULT_PROFIT_RULE。
- **API**：GET /api/profit-rules（全部）、PUT /api/profit-rules（單一商品）、GET /api/profit-rules/calculations?productName=X（保本/目標 ROAS）。

## 4. Scale Score 規則（1–100）

由五部分組成，各 0–20 分：

| 部分 | 說明 |
|------|------|
| 獲利分 | ROAS vs 保本/目標 ROAS（達目標 20，介於保本與目標按比例，低於保本按比例 0–10） |
| 趨勢分 | 1d/3d/7d 多窗口 ROAS 一致性與方向（全好 20、可拉升型 16、假強 4、全差 0） |
| 漏斗分 | ATC 門檻 + ATC→Purchase 比（意圖量與轉換效率分開看） |
| 影響分 | 營收佔比與花費佔比（貢獻度） |
| 信心分 | 花費/點擊/ATC/Purchase 是否達樣本門檻 |

## 5. 預算動作規則

| 動作 | 條件概要 | 建議幅度範例 |
|------|----------|--------------|
| 先降 | ROAS < 保本且花費高 | 關閉 |
| 小降觀察 | ROAS < 保本且花費未達高門檻；或 A 型（1d 好 3d/7d 差） | -30%、-15% |
| 維持 | B 型（1d 差 3d/7d 好）；或 ROAS 介於保本與目標；或樣本不足 | 0% |
| 可加碼 | ROAS ≥ 目標且信心足；或 C 型且漏斗佳 | +10%、+15% |
| 高潛延伸 | C 型、花費佔比低、可拉升 | +20% |

每筆皆回傳：action、suggestedPct（數值或「關閉」）、reason。

## 6. 驗收方式

- **獲利規則中心**：進入「獲利規則中心」，新增/編輯商品之成本比、目標淨利率、樣本門檻，確認保本/目標 ROAS 自動計算並可儲存。
- **API**：GET /api/profit-rules 回傳已存規則；PUT 後再 GET 同商品應為新值；GET /api/profit-rules/calculations?productName=X 回傳 breakEvenRoas、targetRoas。
- **action-center**：有 batch 時，回傳含 budgetActionTable（每筆含 spend、roas、impactAmount、sampleStatus、suggestedAction、suggestedPct、reason、scaleScore、trendABC）；creativeLeaderboard 每筆含 scaleScore、suggestedAction、suggestedPct、budgetReason；tierMainAccount、tierHighPotentialCreatives、tierNoise 三層 8:2。
- **A/B/C**：有 multiWindow 時，A=1d 好 3d/7d 差，B=1d 差 3d/7d 好，C=1d 好 3d 好 7d 普通。
- **意圖量與轉換效率**：漏斗分與規則門檻使用 minATC、minPurchases，並以 ATC 絕對量與 ATC→Purchase 比分別計分。

## 7. Commit hash

（完成 commit 後填寫）
