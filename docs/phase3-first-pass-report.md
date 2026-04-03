# Phase 3 first-pass 回報

**對齊**：`docs/phase3-milestone-and-scope.md`（版本線 b21d03d 首頁收尾修復版、商品主戰場／素材作戰台七件事）。  
**本輪目標**：商品頁改為主戰場、素材頁改為作戰台，回答七件事，沿用首頁視覺與誠實標示，非表格。

---

## 1. 完成狀態

| 項目 | 狀態 |
|------|------|
| 版本線與 Phase 3 範圍文件 | **完成**（`docs/phase3-milestone-and-scope.md`） |
| 商品主戰場（七件事、卡片非表格） | **完成**（`/products` 改為卡片主戰場） |
| 素材作戰台（七件事、卡片非表格） | **完成**（新頁 `/creatives`） |
| 後端 product 級 breakEven/target/headroom | **完成**（action-center 回傳） |
| 側欄與路由 | **完成**（商品主戰場、素材作戰台入口） |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `docs/phase3-milestone-and-scope.md` | **新增**。版本線 11a53b0 / ea7369d / b21d03d、結論、Phase 3 七件事範圍。 |
| `docs/phase3-first-pass-report.md` | **新增**。本回報。 |
| `server/routes.ts` | action-center 之 `productLevelWithRule` 補上 `breakEvenRoas`、`targetRoas`、`profitHeadroom`（商品層）。 |
| `client/src/pages/products.tsx` | 改為 Phase 3 商品主戰場：資料改為有花費且非未分類之 productLevel，每商品一卡回答七件事（值不值得砸、為什麼、靠哪些素材撐、被哪些素材拖、下一步做什麼、成本規則是否可信、breakEven／target／headroom）；標題改為「商品主戰場」；保留 FilterBar、摘要、未映射收合、生成任務。 |
| `client/src/pages/creatives.tsx` | **新增**。素材作戰台：依 action-center 之 creativeLeaderboard + tierHighPotentialCreatives + failureRatesByTag，每素材一卡回答七件事（屬於哪個商品、幫還是拖、是否黑馬、是否疲乏、值不值得延伸、給投手一句話、給設計一句話）；語意色與 evidenceLevel 沿用首頁。 |
| `client/src/App.tsx` | 新增 Route `/creatives` → CreativesPage。 |
| `client/src/components/app-sidebar.tsx` | 成長區新增「素材作戰台」連結 `/creatives`，icon Zap。 |

---

## 3. 商品主戰場是否能回答七件事

| # | 問題 | 是否回答 | 備註 |
|---|------|----------|------|
| 1 | 值不值得砸 | **是** | 依 productStatus（scale/stop/danger/watch）與 ROAS 達標與否，卡上顯示「值得砸／不建議砸／觀察中」。 |
| 2 | 為什麼 | **是** | 顯示 `aiSuggestion`（來自規則引擎 deriveProductRow）。 |
| 3 | 靠哪些素材撐 | **是** | 該商品下 ROAS ≥ 2 之素材取前 3，顯示策略＋標題片段＋ROAS。 |
| 4 | 被哪些素材拖 | **是** | 該商品下 ROAS < 1 或疲乏率 > 0.8 之素材取前 3。 |
| 5 | 下一步做什麼 | **是** | 依 tableRescue／tableScaleUp 該商品筆數顯示「先救 N 檔／可加碼 N 檔」，否則 ruleTags。 |
| 6 | 成本規則是否可信 | **是** | 顯示 costRuleStatus，待補時連結獲利規則中心。 |
| 7 | breakEven／target／headroom 是否可信 | **是** | 有規則時顯示保本、目標、headroom%；無規則時顯示「需先設定成本規則」。 |

---

## 4. 素材作戰台是否能回答七件事

| # | 問題 | 是否回答 | 備註 |
|---|------|----------|------|
| 1 | 屬於哪個商品 | **是** | 顯示 `productName`。 |
| 2 | 幫還是拖 | **是** | 依 ROAS ≥ 2 為幫、ROAS < 1 或疲乏為拖。 |
| 3 | 是不是黑馬 | **是** | 依 tierHighPotentialCreatives 是否含該素材。 |
| 4 | 是不是疲乏 | **是** | 依 failureRatesByTag 該 materialStrategy 陣亡率 > 80%。 |
| 5 | 值不值得延伸 | **是** | 黑馬且 creativeEdge ≥ 1.2 為「值得」，否則「可觀察／暫不建議」。 |
| 6 | 給投手一句話 | **是** | 以 budgetReason ＋ suggestedAction／suggestedPct 組成；無則模板「可小步加預算觀察轉換，勿一次拉滿」。 |
| 7 | 給設計一句話 | **是** | 目前為**模板占位**：「維持此方向，可複製元素到其他素材測試。」 |

---

## 5. 哪些仍是模板占位

- **商品主戰場**：「值不值得砸」內文為前端依 ROAS/status 之固定句（「值得砸，ROAS 達標」等）；「為什麼」為規則引擎之 aiSuggestion，非總監動態句。
- **素材作戰台**：「給設計一句話」為固定模板，未依素材或 creative edge 動態產出；「給投手一句話」有 API 時用 budgetReason＋suggestedAction，缺時用模板。

---

## 6. 哪些資料仍不足或規則缺失

- 商品無成本規則時，breakEven／target／headroom 不顯示，僅提示「需先設定成本規則」；evidenceLevel 會標「規則缺失」。
- 素材之 evidenceLevel（廣告層推測／樣本不足）已顯示；若商品規則缺失，該商品下素材之判讀仍以廣告層為主。
- 首頁與本輪皆未接入今日已調次數（todayAdjustCount）、batch legacy 與 valid 嚴格分流尚未完成。

---

## 7. 是否已可作為正式 Phase 3 first-pass

- **是**。商品主戰場與素材作戰台已上線為卡片式、回答七件事，沿用首頁主次層級與語意色，evidenceLevel／規則缺失如實標示，可作為正式 Phase 3 first-pass。
- 後續可補：動態總監判語、給設計一句話動態產出、todayAdjustCount、batch 分流。

---

## 8. Commit hash

| 項目 | 值 |
|------|-----|
| **本輪 commit** | **7bc608f**（Phase 3 first-pass: 商品主戰場、素材作戰台七件事，卡片非表格） |
