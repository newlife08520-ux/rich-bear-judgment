# 06 — CREATIVE INTELLIGENCE, GOAL, PACING, PARETO

## Creative Intelligence 現況

| 面向 | 狀態 | 說明 |
|------|------|------|
| 主鏡頭／沉睡帶 | 較成熟 | 與首頁／商品／FB 的 dormant operational v7 語系對齊；有 batch99_2 等契約守門 |
| 標籤／時間線／工作台 | Partial | 可用，但與「完整創意生命週期產品」仍有距離 |
| Review／queue | Partial | 結構存在；排程與營運日常閉環未達最終形態 |
| 版本級歸因 | First version | 能呈現部分版本與成效關聯；**跨平台／延遲歸因／樣本不足** 時語意須審慎解讀 |

**風險**：審查者若把 CI 當「已等同 MMP／創意實驗平台」會高估；實際是 **決策工作台的一翼**，與 FB 批次與 visibility 政策共用底層。

## Goal／Pacing 引擎現況

- **實作錨點**：`@shared/goal-pacing-engine`；敘事與閾值版本需與 Settings 對齊。  
- **觀察窗（observation window）**：決定「何時才算看夠」；與 batch28_2（precedence）相關驗收。  
- **todayAdjustCount**：用於節流「今日已調幾次」類敘事，避免營運過度頻繁調整卻無記憶。  
- **targetOutcomeValue**：目標結果值的對齊點；與 pacing copy 品質（batch28_3）綁定。  
- **Adjust ledger**：`execution-adjust-ledger` 等與「調整歷史」相關；自動 append 行為有 batch28_1 守門。

**已完成**：核心欄位與腳本驗收鏈存在，首頁／Judgment 可引用 pacing 敘事。  
**Partial**：多帳戶、跨 scope 時文案是否總與 API 一致，需 spot check。  
**未完成**：「全站單一 pacing 真相儀表板」級產品化仍非主線。

## Pareto／82 法則現況

- **多層級 Pareto**：batch29 驗證；UI 有 `ParetoCommandLayerStrip` 等指揮層元件。  
- **模糊邊界**：batch29_1（hidden diamond vs money pit）處理語意模糊時的防誤導。  
- **與 command panel 關係**：首頁層級呈現「先做哪一層、哪一批」的排序邏輯，**不是**單純按花費或 ROAS 排序。

**First version 區**：極端帳戶（大量長尾、0 spend 混雜）下，Pareto 分層與 visibility 的交界仍是最值得真實資料驗的區域。

## 原始構想 vs 落地缺口（誠實）

- **已落地**：引擎＋verify＋首頁／CI 表面可讀；與 dormant、visibility 同一哲學（不全隱藏 0 spend、區分 partial／no data）。  
- **尚未完全成熟**：CI 版本歸因的「可辯護統計故事」、queue 與 execution 的無縫銜接、與 Publish 的閉環。  
- **Gemini 應優先質疑**：  
  1. `targetOutcomeValue` 與實際廣告目標（oCPM／價值優化等）是否總一致。  
  2. observation window 與 Meta 學習期／報表延遲是否可能讓 pacing 敘事「看似合理但行動錯誤」。  
  3. todayAdjustCount 是否在所有建立任務／Meta 調整路徑都被正確累加或讀取。  
  4. Pareto 多層在樣本稀疏時是否仍穩定（會不會把雜訊當「82 頂層」）。  
  5. CI 與 Products／FB 對同一 creative 的 ID 對齊是否可能漂移。

## 下一步（產品／工程）

- 用真實帳戶跑一輪：pacing 敘事 ↔ 實際調整 ↔ ledger。  
- 將 CI 歸因限制寫進 UI 常駐免責（已有 tier 思維者可對齊）。  
- 持續縮小 `routes.ts`／schema 巨型檔，降低改 pacing 時的連鎖風險。
