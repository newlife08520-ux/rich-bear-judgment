# 產品層重構計畫

## 一、問題拆解

### 1. 資料判斷邏輯
- **現象**：0 花費／0 投遞／樣本不足的素材被列入黑榜或「成效最差」，造成誤判。
- **根因**：黑榜僅依 ROAS 升序取前 N 筆，未排除樣本不足；金榜僅依 ROAS 降序，未區分「已驗證贏家」與「潛力股」。
- **缺口**：素材無分級（Winner / Potential / Borderline / Loser / Unproven）；排序未採 8:2 思維（誰真正貢獻營收／誰值得放大）。

### 2. 首頁判斷框架
- **現象**：首頁堆砌資訊，決策焦點不清。
- **根因**：未以「決策首頁」設計，缺少明確四問：誰在賺錢、誰最危險、誰最值得放大、今天先做哪 3 件事。

### 3. 分數系統黑箱
- **現象**：健康、信心、機會、急迫、Priority 無從解釋。
- **根因**：無定義、計算來源、門檻、顏色規則、對應動作，且不可展開。

### 4. 不可操作項目
- **現象**：Priority、警報、商品作戰室警告、黑榜項目無法點擊。
- **根因**：未提供詳情（為何被判、用了哪些數據、建議下一步、導向處理頁）。

### 5. 資訊架構
- **現象**：老闆視角與操作視角平鋪混在一起。
- **根因**：導航未分群為決策／成長／分析／工具。

### 6. 成功率頁
- **現象**：幾乎全部 0%，缺乏可信度。
- **根因**：成功定義、Winner/Lucky/漏斗通過率/品質分計算與資料來源未釐清；若無上線或無達標則自然為 0。

---

## 二、先修哪三個模組

1. **模組 A：資料判斷邏輯**  
   素材分級（Unproven 排除黑榜）、門檻（最小花費/曝光）、8:2 排序（營收貢獻 + 潛力優先）。

2. **模組 B：決策首頁框架 + 分數可解釋**  
   首頁改為四問 + 今日先做 3 件事；分數定義 API + 可展開說明與對應動作。

3. **模組 C：導航重構 + 成功率頁釐清**  
   左側導航改為決策／成長／分析／工具；成功率頁補定義與 disclaimer，必要時降級非核心指標。

---

## 三、實際修改檔案

| 模組 | 檔案 |
|------|------|
| A | `shared/material-tier.ts`（新建）、`shared/tag-aggregation-engine.ts`、`server/routes.ts`（action-center）、`client/src/pages/dashboard.tsx` |
| B | `shared/score-definitions.ts`（新建）、`server/routes.ts`（GET /api/scoring/definitions）、`client/src/pages/dashboard.tsx`（決策區塊、分數可點擊展開） |
| C | `client/src/components/app-sidebar.tsx`、`client/src/pages/scorecard.tsx` |

---

## 四、新判斷邏輯

### 素材分級（Material Tier）
- **Unproven**：`spend < MIN_SPEND_JUDGMENT`（100）或 `impressions < MIN_IMPRESSIONS`（1000）或（`clicks < 30` 且 `conversions === 0`）。不列入黑榜、不作為「成效最差」。
- **Loser**：已達樣本門檻且 ROAS < 1（或低於帳號平均一定比例），可列入黑榜。
- **Borderline**：已達樣本，ROAS 介於 1～目標（如 1.5），僅觀察。
- **Potential**：已達樣本，ROAS ≥ 目標，花費占比低，可擴量。
- **Winner**：已達樣本，ROAS ≥ 目標，營收貢獻高（8:2 頭部）。

### 黑榜／金榜規則
- **黑榜**：僅從 `materialTier === "Loser"` 中取，按 ROAS 升序，最多 6 筆；無則顯示「無符合條件的黑榜素材」。
- **金榜**：優先顯示 Winner，再 Potential；排序改為「營收貢獻降序」再「ROAS 降序」；可標示 Tier 標籤。

### 分數可解釋
- 每個分數（health, urgency, opportunity, confidence, priority）提供：定義、計算來源、門檻、顏色規則、對應動作。
- API：`GET /api/scoring/definitions` 回傳上述結構；前端可點擊分數展開。

---

## 五、驗收方式

- A：黑榜中無 0 花費／0 投遞／明顯樣本不足之素材；金榜/黑榜顯示 Tier；商品與素材排序偏向營收貢獻與潛力。
- B：首頁可見「今天誰在賺錢／誰最危險／誰最值得放大／今天先做哪 3 件事」；分數可點擊並展開定義與建議動作。
- C：左側導航為決策／成長／分析／工具四群；成功率頁有定義說明與資料不足 disclaimer。

---

## 六、Commit

`d8e9423` — refactor(product): 資料判斷邏輯、決策首頁、分數可解釋、導航與成功率頁
