# 首頁收尾修復輪 — 回報

**目標**：把首頁從 first pass 拉到可用版，暫不進 Phase 3。  
**本輪五事**：成本規則入口、debug source meta 收斂、次級舊報表瘦身、五區資訊密度重排、/api/auth/me 401 追查。

---

## 1. 完成狀態

| 項目 | 狀態 |
|------|------|
| 商品成本規則入口 | **完成**（首頁多處引導至獲利規則中心） |
| debug source meta 收斂 | **完成**（預設收起，「查看資料來源」觸發展開） |
| 次級舊報表瘦身 | **完成**（0 花費預設隱藏、有花費才顯示排行榜/紅黑榜/創意榜） |
| 首頁五區資訊密度重排 | **完成**（區塊 1 強化、2/3 對比說明、區塊 4 空態、區塊 5 footer 化） |
| /api/auth/me 401 根因與影響 | **完成**（已釐清，見 §7） |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `client/src/pages/dashboard.tsx` | 成本規則入口（區塊 1 空態、區塊 2 標題旁與空態、區塊 5 內文）連結至 `/settings/profit-rules`；source meta 改為 Collapsible「查看資料來源」預設收起；區塊 2/3 副標與區塊 4 空態、區塊 5 footer 化；次級區 ProductRedBlackBoard / 全公司商品排行榜 / CreativeLeaderboardHero 僅顯示有花費項目，全公司排行榜加註「僅顯示有花費之商品」。 |
| `client/src/lib/auth.tsx` | 註解說明 401 為未登入預期行為，不影響首頁核心 query。 |

---

## 3. 成本規則入口做在哪

- **獲利規則中心**：既有頁面 `/settings/profit-rules`（`client/src/pages/settings-profit-rules.tsx`），可設定各商品**成本比、目標淨利率、樣本門檻**，系統自動算保本 ROAS、目標 ROAS；側欄與設定頁已有入口。
- **本輪新增首頁引導**：
  - **區塊 1**（今日最該動的 5 件事）：空態時文案改為「請先至 **獲利規則中心** 設定各商品成本比與目標 ROAS，並同步資料」，並加連結。
  - **區塊 2**（主力商品戰情）：標題列右側加「設定成本規則」連結；空態時加「請至 **獲利規則中心** 設定各商品成本比與目標淨利率」。
  - **區塊 5**（節制提醒）：內文加「欲減少『規則缺失』請至 **獲利規則中心** 設定成本比與目標淨利率」。

---

## 4. 哪些首頁區塊因此不再大量顯示「規則缺失」

- **區塊 1**：空態時直接引導去設規則，減少「沒有東西可看又不知道要幹嘛」。
- **區塊 2**：主力商品戰情本身依後端 `productLevelMain`（需 `hasRule === true`）；沒規則時本來就顯示「尚無主力商品」，本輪加上明確「請至獲利規則中心」引導，使用者知道去哪裡補規則。
- **區塊 5**：明寫「欲減少規則缺失請至獲利規則中心」，把「規則缺失」與**可執行動作**綁在一起。
- **後端邏輯未改**：`productLevelMain` 仍只含已設規則且達標商品；沒規則時仍誠實保守、不強推主力，僅在首頁多處提供設定入口。

---

## 5. debug source meta 如何收起

- **原本**：`sourceMeta` 直接攤在首頁一區塊（batchId、generatedAt、scopeKey、excludedNoDelivery、excludedUnderSample、unmappedCount 等）。
- **現在**：改為 **Collapsible**，觸發按鈕文案「**查看資料來源**」，**defaultOpen={false}**；點擊後才展開，內容同前（batchId、generatedAt、dateRange、scopeKey、campaignCountUsed、excludedNoDelivery、excludedUnderSample、unmappedCount），字體為小號、mono，視覺像 debug drawer，不搶主區。

---

## 6. 次級舊報表如何瘦身

- **0 花費預設隱藏**：
  - **商品戰力紅黑榜**（ProductRedBlackBoard）：改為只傳入 `productLevel.filter(p => p.spend > 0)`，0 花費商品不進入紅黑榜。
  - **全公司商品排行榜**（舊版報表內）：僅顯示 `productLevel.filter(p => p.spend > 0)`，並加說明「僅顯示有花費之商品，0 花費已隱藏」；若過濾後無筆數則不渲染該卡。
  - **創意金榜**（CreativeLeaderboardHero / CreativeBlacklistSection）：舊版報表內改為只傳入 `creativeLeaderboard.filter(c => c.spend > 0)`；若過濾後無筆數則不渲染。
- **未投遞／無意義**：待驗證區說明維持「尚有 X 筆未投遞、Y 筆樣本不足…」僅在 X+Y > 0 時顯示（原本即如此）；今日先救／可加碼／維持／延伸表為後端 decision_ready，本身已排除未投遞／樣本不足，未再於前端加表。
- 效果：次級區展開後不再像整個舊後台搬進來，只顯示有花費、有決策意義的內容。

---

## 7. /api/auth/me 401 根因與影響範圍

- **誰在打**：`client/src/lib/auth.tsx` 的 `AuthProvider` 在 mount 時執行一次 `fetch("/api/auth/me", { credentials: "include" })`，用來判斷目前是否已登入。
- **為什麼會 401**：後端 `server/routes.ts` 的 `GET /api/auth/me` 在 `!req.session.userId` 或使用者不存在時回傳 `401`（未登入）。因此**未登入或 session 過期時出現 401 為預期行為**。
- **是否影響首頁資料**：**不影響首頁核心區 query**。理由：
  - 首頁與 `GET /api/dashboard/action-center` 等 API 都在已登入後才會被使用（`AppRouter` 在 `!user` 時渲染 `LoginPage`，只有 `user` 存在時才渲染含 Dashboard 的 `AuthenticatedApp`）。
  - 401 發生時，前端將 `user` 設為 `null`，畫面顯示登入頁，不會去打 action-center；登入成功後重新掛載才會打 action-center。
- **結論**：401 僅表示「目前未登入」，不影響已登入狀態下之首頁 action-center 或其它核心 query。已在 `auth.tsx` 加註說明。

---

## 8. 還剩哪些醜／哪些不可信

- **醜**：區塊 2/3/4 仍偏報表感；區塊 1 卡片可再精簡視覺；今日最該動的 5 件事仍為配額拼接，非全局排序。
- **不可信**：todayActions 仍為 first pass；區塊 2 主判語、區塊 4 給投手／給設計仍為前端模板；batchValidity legacy 未與 valid 嚴格區分；todayAdjustCount 未接入。

---

## 9. 是否可正式進 Phase 3

- **本輪結論**：首頁已從 first pass 收尾到**可用版**（成本規則有入口、source meta 收起、次級瘦身、五區重排、401 釐清），**可依產品規劃決定是否進 Phase 3**。
- **仍不可宣稱**：首頁為「最終完成版」；todayActions 全局排序、動態總監判語、todayAdjustCount、batch 分流等屬 Phase 3 或後續範疇。

---

## 10. Commit hash

| 項目 | 值 |
|------|-----|
| **本輪 commit** | **b21d03d** |
