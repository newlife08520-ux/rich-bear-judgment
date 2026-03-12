# Phase 2B：首頁五區重做 — 交付回報

**對齊**：`docs/華麗熊-總監操盤系統-最終整合版.md` §24～25、§41，Phase 2A 三點承認。  
**本輪目標**：首頁第一屏改為「總監晨會桌面」固定五區，讓使用者第一眼能回答：今天先放大誰、先止血誰、不要誤殺誰、最值得延伸誰。

---

## 1. 完成狀態

| 區塊 | 狀態 |
|------|------|
| 區塊 1：今日最該動的 5 件事 | **完成** |
| 區塊 2：主力商品戰情 | **完成** |
| 區塊 3：高預算危險商品 | **完成** |
| 區塊 4：被埋沒的黑馬素材 | **完成** |
| 區塊 5：今日操作節制提醒 | **完成** |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `server/routes.ts` | action-center：新增 `buildDirectorVerdict`、`TodayActionRow` 型別；由 tableRescue（最多 2）、tableScaleUp（最多 2）、tableNoMisjudge（最多 1）、tableExtend（最多 2）合併產出 `todayActions`（最多 5 筆），每筆含 type、objectType、productName、spend、revenue、roas、suggestedAction、suggestedPct、evidenceLevel、reason、whyNotMore、**directorVerdict**；early return 與 res.json 皆加入 `todayActions`。 |
| `client/src/pages/dashboard.tsx` | ActionCenterData 新增 `todayActions` 型別；query fallback 補 `todayActions: []`；將原「決策焦點 · 優先回答四問」四張卡改為 **Phase 2B 固定五區**：區塊 1 今日最該動的 5 件事（todayActions + directorVerdict + evidenceLevel Badge）、區塊 2 主力商品戰情（productLevelMain + 一句主判語）、區塊 3 高預算危險商品（tableRescue + riskyCampaigns）、區塊 4 黑馬素材（tierHighPotentialCreatives + 給投手/給設計一句話）、區塊 5 今日操作節制提醒（batchValidityReason、未投遞/樣本不足、廣告層推測、本輪尚未接入今日已調次數）。 |

---

## 3. 首頁第一屏是否真的回答四件事

| 問題 | 回答 |
|------|------|
| 今天先放大誰，看得出來嗎 | **是**。區塊 1 中 type＝「放大」的項目即為今日建議放大對象；區塊 2 主力商品戰情亦標示「維持或小步放大」。 |
| 今天先止血誰，看得出來嗎 | **是**。區塊 1 中 type＝「止血」的項目即為今日建議止血對象；區塊 3 高預算危險商品列出 tableRescue + riskyCampaigns，並有建議動作。 |
| 今天不要誤殺誰，看得出來嗎 | **是**。區塊 1 中 type＝「不要誤殺」的項目即為今日不建議誤殺對象（最多 1 筆）；區塊 5 節制提醒標示規則缺失／樣本不足勿亂動。 |
| 今天最值得延伸誰，看得出來嗎 | **是**。區塊 1 中 type＝「值得延伸」的項目即為今日最值得延伸對象；區塊 4 黑馬素材列出 tierHighPotentialCreatives，並有給投手/給設計一句話。 |

---

## 4. 五區塊各自的資料來源

| 區塊 | API／資料來源 | 使用欄位 | Guardrail 已套用 | 排除／次級 |
|------|----------------|----------|------------------|------------|
| 區塊 1：今日最該動的 5 件事 | `GET /api/dashboard/action-center` → `todayActions` | type, objectType, productName, campaignName, spend, revenue, roas, breakEvenRoas, targetRoas, suggestedAction, suggestedPct, evidenceLevel, reason, whyNotMore, directorVerdict | 僅來自 budgetActionDecisionReady（排除 no_delivery、under_sample）；tableScaleUp 僅 hasRule；tableExtend 為 creativeEdge≥1.2、funnelOk、sampleOk、lowSpend | 未進 todayActions 的 rescue/scaleUp/noMisjudge/extend 仍在下方詳細表 |
| 區塊 2：主力商品戰情 | 同上 → `productLevelMain` | productName, spend, revenue, roas, evidenceLevel | productLevelMain 為 spend>0 且 productName!=='未分類'；evidenceLevel 已標 | 未分類、花費 0 在 productLevelNoDelivery / productLevelUnmapped |
| 區塊 3：高預算危險商品 | 同上 → `tableRescue`、`riskyCampaigns` | campaignId, campaignName, productName, spend, revenue, roas, reason, suggestedAction, suggestedPct | tableRescue 來自 decision_ready 且 suggestedAction 為「先降」或關閉；依花費排序 | riskyCampaigns 與 tableRescue 去重後一併顯示 |
| 區塊 4：黑馬素材 | 同上 → `tierHighPotentialCreatives`（= tableExtend.slice(0,10)） | productName, materialStrategy, headlineSnippet, spend, revenue, roas | creativeEdge≥1.2、funnelOk、sampleOk、lowSpend；核心創意榜已排除 under_sample | 其餘創意在 creativeLeaderboard 或下方表 |
| 區塊 5：今日操作節制提醒 | 同上 → `batchValidityReason`、`budgetActionNoDelivery`、`budgetActionUnderSample`、`funnelEvidence` | 說明文字 | 明示未投遞/樣本不足筆數、無漏斗資料為廣告層推測、本輪尚未接入今日已調次數 | — |

---

## 5. 總監語言落地狀況

| 項目 | 狀況 |
|------|------|
| 區塊 1 一句總監判語 | **已落地**。每筆 todayActions 顯示 `directorVerdict`（後端由 type + reason + suggestedAction + suggestedPct + whyNotMore 組成）。 |
| 區塊 2 主判語 | **已落地**。每筆主力商品顯示一句：「主力：花費佔比高、ROAS X.XX 達標，建議維持或小步放大。」（目前為前端模板，可改由後端 §41 產出） |
| 區塊 3 主判語 | **已落地**。每筆顯示 reason + 建議動作（來自 tableRescue.reason、suggestedAction、suggestedPct）。 |
| 區塊 4 給投手一句話、給設計一句話 | **已落地**。每筆黑馬顯示：「給投手：可小步加預算觀察轉換，勿一次拉滿。」「給設計：維持此方向，可複製元素到其他素材測試。」（目前為前端固定模板，可改由後端依素材產出） |
| 區塊 5 總監語氣 | **已落地**。節制提醒使用「本批資料：…」「尚有 X 筆未投遞、Y 筆樣本不足，不參與核心決策，請勿依此亂調預算。」「本輪尚未接入今日已調次數…」等，非一般系統說明。 |
| 是否有語氣退化成普通 AI／報表備註 | **無**。區塊 1 以 directorVerdict 為主；區塊 2～5 皆為結論＋建議，未重複畫面已見數字，未使用禁用句型。 |

---

## 6. 還剩哪些污染（不粉飾）

- **todayAdjustCount**：本輪未接入「今日已調次數」，區塊 5 已明示「本輪尚未接入今日已調次數，先以 guardrail 提醒代替」。
- **區塊 2 主判語**：目前為前端固定模板一句，尚未由後端或 §41 規則依商品動態產出。
- **區塊 4 給投手/給設計**：目前為前端固定兩句，尚未依素材或 creative edge 動態產出。
- **區塊 2 在撐素材數／在拖素材數**：規格要求有「在撐素材數」「在拖素材數」，目前未接 API，未顯示。
- **batchValidity legacy**：仍如 Phase 2A 承認，legacy 僅規格占位，未與 valid 嚴格區分。
- **evidenceLevel**：僅首頁核心決策區落地，商品主戰場／素材作戰台等尚未全站統一。

---

## 7. 是否可進 Phase 3

| 檢查項 | 回答 |
|--------|------|
| 首頁第一屏是否已可信 | **是**。五區固定骨架已上線，核心區為 decision_ready＋evidenceLevel 標示＋節制提醒。 |
| 首頁主角是否已從帳號轉為動作＋商品 | **是**。區塊 1～4 以動作類型、商品、危險、黑馬為主；帳號區已於 Phase 2A 收合為次級。 |
| 總監語言是否已開始落地 | **是**。區塊 1 為後端 directorVerdict；區塊 2～5 已有結論＋建議語氣，部分為前端模板可後續改後端。 |
| **can proceed / cannot proceed** | **can proceed**。首頁五區骨架與四問可答已達成；todayAdjustCount、區塊 2/4 動態判語可列為 Phase 3 或後續迭代。 |

---

## 8. Commit hash

- **程式 commit**：（請於本輪 commit 後補上）
- **文件 commit**：（請於本輪 commit 後補上）
