# Phase 3A：商品主戰場 first-pass（UI/資訊版）回報

**本輪定位**：商品主戰場 **UI/資訊 first-pass**，不是商品決策引擎最終版、不是總監語言完整落地版。  
**範圍**：僅商品主戰場 first-pass；首頁凍結（b21d03d）、不開素材作戰台、不改 prompt／workflow／首頁五區。  
**目標**：商品頁結構像主戰場、七件事有對應欄位、規則缺失誠實標示；總監判語與部分邏輯仍為模板／規則拼接，屬前台 first-pass。

**口徑**：不得宣稱「商品主戰場完成版」「商品判斷引擎完成」「商品頁最終版」或「總監語言已落地」。

---

## 1. 完成狀態

| 項目 | 狀態 |
|------|------|
| 首頁凍結說明 | **完成**（docs/phase3-milestone-and-scope.md 標註 b21d03d 凍結） |
| 商品主表改主戰場樣式 | **完成**（卡片網格、非滿版表格） |
| 每卡回答七件事 | **完成** |
| 總監判語 | **完成**（每卡一句，來自規則引擎 aiSuggestion） |
| 成本規則狀態／breakEven／target／headroom | **完成**（已設定／待補＋連結；有規則時顯示三數） |
| 在撐／在拖素材數 | **完成**（每卡 footer 顯示在撐 N 支 · 在拖 M 支） |
| evidenceLevel／誠實標示 | **完成**（Badge＋無規則時「需先設定成本規則」） |
| 本輪未做 | 素材作戰台整頁、首頁改動、prompt/workflow 改動 |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `docs/phase3-milestone-and-scope.md` | 新增「首頁凍結」段落，明訂 b21d03d 為首頁暫定版、不再微調。 |
| `docs/phase3a-report.md` | 本回報。 |
| `client/src/pages/products.tsx` | 摘要區補一句「每張卡回答七件事」說明；每卡新增「總監判語：」一行（aiSuggestion）；「靠哪些素材撐／被哪些素材拖」改為顯示前 3 筆＋總數（…共 N 支）；卡片 footer 新增「在撐 N 支 · 在拖 M 支」；註解改為 Phase 3A。 |

---

## 3. 商品頁是否能回答七件事

| # | 問題 | 是否回答 | 備註 |
|---|------|----------|------|
| 1 | 這商品現在值不值得砸 | **是** | 依 productStatus／ROAS 顯示「值得砸，ROAS 達標」「不建議砸，先止血」「觀察中」。 |
| 2 | 為什麼值得／為什麼危險 | **是** | 「為什麼」區塊＋每卡「總監判語」皆顯示 aiSuggestion（規則引擎產出）。 |
| 3 | 靠哪些素材在撐 | **是** | 列出 ROAS ≥ 2 素材前 3 筆＋「…共 N 支」，無則「尚無高 ROAS 素材」。 |
| 4 | 被哪些素材在拖 | **是** | 列出 ROAS &lt; 1 或疲乏率 &gt; 0.8 之前 3 筆＋「…共 M 支」，無則「尚無明顯拖累」。 |
| 5 | 下一步應該做什麼 | **是** | 依 tableRescue／tableScaleUp 顯示「先救 N 檔」「可加碼 N 檔」，否則 ruleTags。 |
| 6 | 成本規則是否已設定且可信 | **是** | 顯示「已設定，可依保本／目標判斷」或「待補，點此設定」連結獲利規則中心。 |
| 7 | breakEven／target／headroom 是否可信 | **是** | 有規則時顯示保本、目標、headroom%；無規則時「需先設定成本規則」。 |

---

## 4. 哪些欄位仍是資料不足／規則缺失

- **成本規則**：未設定時整卡 breakEven／target／headroom 不顯示數值，僅提示需先設定；evidenceLevel 會標「規則缺失」。
- **在撐／在拖**：依 creativeLeaderboard 與 failureRatesByTag 計算；若該商品無創意資料則為 0 支。
- **下一步**：依 action-center 之 tableRescue／tableScaleUp；若後端無該商品 rescue/scaleUp 則顯示 ruleTags（規則引擎標籤），非活動級 suggestedAction。
- **qualityLabel**：目前 API 未提供商品級 qualityLabel，僅有 productStatus（加碼／停損／危險／觀察）與 evidenceLevel；若未來要顯示 qualityLabel 需後端支援。

---

## 5. 哪些仍是模板占位

- **總監判語**：內容為規則引擎之 aiSuggestion（deriveProductRow），非動態總監語言層；語意正確但非一句話總監口吻。
- **值不值得砸**：選項為前端固定句（「值得砸，ROAS 達標」等），非依 breakEven／target 動態造句。
- **為什麼**：同 aiSuggestion，為規則引擎輸出，非總監動態判語。

---

## 6. 是否已可作為商品主戰場 first-pass（UI/資訊版）

**是。** 商品頁已有主戰場骨架與七件事欄位、在撐/在拖數、成本規則與 breakEven／target／headroom、規則缺失誠實標示；可作為 **商品主戰場 UI/資訊 first-pass**。  
**未完成**：總監判語仍為規則引擎 aiSuggestion、值不值得砸為前端固定句、在撐/在拖為 creativeLeaderboard＋failureRatesByTag 之 first-pass 湊法，非完整商品決策引擎。後續需補：真總監判語、決策語言層、穩定的商品—素材幫/拖邏輯。

---

## 7. Commit hash 與版本線

| 項目 | 值 |
|------|-----|
| **程式 commit** | **53afeb4**（商品主戰場 first-pass 程式版） |
| **文件 commit** | **28f71ed**（商品主戰場 first-pass 文件版） |
| **版本線** | b21d03d 首頁收尾修復版 → 53afeb4 商品主戰場 first-pass 程式版 → 28f71ed 商品主戰場 first-pass 文件版 |

---

## 附：Staging 商品頁 6 項最短驗收

Push 後請實際打開 staging 商品頁，驗以下 6 項（不要只看回報）：

1. 一打開商品頁，還像不像表格頁  
2. 有沒有真的一眼看出哪個商品值得砸  
3. 規則缺失時，會不會誠實而不是亂判  
4. 在撐／在拖看起來是不是有感，不是純數字  
5. breakEven／target／headroom 顯示有沒有幫助決策  
6. 整頁有沒有比首頁更像「主戰場」，而不是「商品總表」
