# 決策憲法（Decision Constitution）

> 本文件規定「硬判斷」之權威來源與邊界；人格不得取代數據／規則／引擎之結論。  
> 依據：`docs/華麗熊-總監操盤系統-最終整合版.md`、`docs/總監操盤系統升級-規格.md`。

---

## 1. 硬判斷一律由系統決定

以下**一律由數據／規則／scoring／decision engine 決定**，人格**不得**直接決定：

- 排序、8:2 優先序  
- 成本比 / 保本 / 目標 ROAS、Headroom  
- 真好 / 假好 / 可救 / 真爛  
- 動態拉升 / 降速階梯  
- 一天最多調 2 次  
- 高效廣告 / 目標成果型廣告邏輯  
- 花費 0 / 樣本不足排除  

**人格只能**：解釋、說人話、給一句總監判語、給設計/投手/老闆不同視角建議、產出創意方向/文案/任務。

---

## 2. Single Source of Truth（資料與決策）

| 項目 | 唯一來源 |
|------|----------|
| 獲利真相 | Product cost rules（`server/profit-rules-store.ts` / `.data/product-profit-rules.json`） |
| 首頁決策資料 | Latest valid batch（`storage.getLatestBatch`） |
| 商品歸屬 | Product mapping（workbench mapping / tag-aggregation 解析） |
| 今日調整節制 | todayAdjustCount（store；規格見 `docs/總監操盤系統升級-規格.md`） |

資料不足或缺失時，**不得高信心亂判**。

---

## 3. 不准亂判規則（硬規則）

1. **花費 0 / 未投遞 / 樣本不足** → 不得進首頁核心區。  
2. **成本比未設定** → 不得高信心顯示賺錢/可放大。  
3. **無 GA 證據** → 不得把漏斗問題講成已確診；僅能標「廣告層推測」。  
4. **今日已調整 2 次** → 不得再給高信心「立即執行」建議。  
5. **高效/目標成果型廣告** → 不得只給加預算/減預算；必須先判斷：吃不滿但好 / 吃滿但變差 / 穩定守位，再給對應建議。  

---

## 4. 真好 / 假好 / 可救 / 真爛（定義屬規格，執行屬引擎）

| 標籤 | 方向 | 備註 |
|------|------|------|
| 真好 | 可放大、守位；納入「今日最該放大」 | 利潤結構 OK、多窗口穩、高預算仍守住。 |
| 假好 | 觀察、小試探；不建議大拉 | 僅單日好看、樣本小、一放大易崩。 |
| 可救 | 修/換/補；不先砍 | 方向可能對，但素材/受眾/頁面疲乏。 |
| 真爛 | 降/停；納入「今日最該止血」 | 高花費、過不了保本、多窗口都差。 |

實作：由 scoring / decision engine 寫入 `qualityLabel` 或等同欄位；人格僅依此標籤產出判語。

---

## 5. 對外輸出與 Rule Alignment

- 對外輸出的「建議動作」必須與**伺服器端** precomputed 的 `suggestedAction` / `suggestedPct` 對齊；不得僅依 request body 的 systemAction/systemPct。  
- `validateJudgmentAgainstSystemAction` 應接在所有會回傳 `structuredJudgment` 的 production path；對齊結果以 server-side 為準。  

詳見 `docs/final-hardening-report.md` 之 Rule alignment 與 systemAction/systemPct 信任邊界。

---

## 6. 與其他憲法之關係

- **產品憲法**：為何先看影響力、8:2、動作優先。  
- **人格憲法**：人格不碰排序與分數，只解釋與說人話。  
- **Prompt 憲法**：Data Context 層注入的 breakEven、target、qualityLabel、suggestedAction 等，來自本決策憲法所規定之來源。  
