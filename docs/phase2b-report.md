# Phase 2B：首頁五區重做 — 交付回報

**對齊**：`docs/華麗熊-總監操盤系統-最終整合版.md` §24～25、§41，Phase 2A 三點承認。  
**本輪目標**：首頁第一屏改為「總監晨會桌面」固定五區，讓使用者第一眼能回答：今天先放大誰、先止血誰、不要誤殺誰、最值得延伸誰。

---

## 0. 完成語氣修正（三點明確承認）

本輪**不接受**將 Phase 2B 定義為「首頁最終完成版」。以下三點必須在回報中寫清楚：

**1. todayActions 目前是 first pass，屬「各類型配額拼接 + 取前 5」，尚未是全局影響力／急迫度最終排序。**

- 現行組法：tableRescue 最多 2、tableScaleUp 最多 2、tableNoMisjudge 最多 1、tableExtend 最多 2，合併後取前 5。
- 此為「每類先配額」的拼湊，**不是**依影響力、急迫性、利潤風險、可放大價值、誤殺風險（及未來 todayAdjustCount／observation window）的**全局真正最重要的前 5 件事**。
- 後續必須升級為**全局排序邏輯**，而非維持 quota 式拼接。

**2. 區塊 2 主判語、區塊 4 給投手／給設計一句話，仍為前端模板占位，尚未是完整動態總監語言層。**

- 區塊 1 的 directorVerdict 已開始落地（後端組出）。
- 區塊 2、區塊 4 目前為前端固定模板句，**不能**宣稱「總監語言已完整落地」；下一輪需接成真正動態產出。

**3. 區塊 5 為節制提醒 first pass；todayAdjustCount 尚未真正接入；legacy batch 仍未與 valid 完整嚴格區分。**

- 區塊 5 現為 Phase 2B 的 **guardrail 版節制提醒**，有價值（不要亂動、資料不足、廣告層推測、誠實標示尚未接入今日已調次數），但**不等於**已具備完整動作節制引擎。
- batchValidity 的 **legacy** 仍如 Phase 2A：僅規格占位，尚未與 valid 嚴格區分；不得宣稱 batch 分流已完全成熟。

---

## 1. 完成狀態

| 項目 | 狀態 |
|------|------|
| 首頁五區骨架 | **完成** |
| 區塊 1 directorVerdict | **完成**（後端組出，已開始落地） |
| 區塊 2 主判語 | **模板占位**（前端固定一句，尚未動態總監語言層） |
| 區塊 4 投手／設計一句話 | **模板占位**（前端固定兩句，尚未動態產出） |
| 區塊 5 節制提醒 | **guardrail 版**（first pass，todayAdjustCount 未接入） |
| staging 已部署 | **是**（已 push 至 origin/main，依 Railway 從 main 部署；可驗收網址見 §7） |

---

## 2. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| `shared/schema.ts` | EvidenceLevel、BatchValidity 型別與常數（Phase 2A） |
| `shared/batch-validity.ts` | **新增**。getBatchValidity(batch)（Phase 2A） |
| `server/routes.ts` | action-center：Phase 2A 排除 no_delivery/under_sample、evidenceLevel、batchValidity、budgetActionNoDelivery/UnderSample、成本缺失降級；Phase 2B 新增 todayActions（配額拼接 2+2+1+2→5）、buildDirectorVerdict、TodayActionRow。 |
| `client/src/pages/dashboard.tsx` | Phase 2A：batch 橫幅、evidenceLevel Badge、帳號區收合為次級、待驗證區說明。Phase 2B：首頁固定五區（區塊 1～5）、todayActions 顯示 directorVerdict、區塊 2/4 模板句、區塊 5 節制提醒 guardrail 版。 |
| `docs/phase1-runtime-pollution-audit.md` | Phase 1 盤點（新增） |
| `docs/phase2a-guardrails-report.md` | Phase 2A 回報與三點承認（新增） |
| `docs/phase2b-report.md` | 本文件（Phase 2B 回報與完成語氣修正） |

---

## 3. 本輪哪些是已完成、哪些是 first pass

**已完成（可驗收為本輪交付）：**

- 首頁五區骨架固定順序：今日最該動的 5 件事、主力商品戰情、高預算危險商品、黑馬素材、今日操作節制提醒。
- 區塊 1 由後端產出 todayActions，含 type、對象、suggestedAction、whyNotMore、directorVerdict；前端顯示 directorVerdict 與 evidenceLevel Badge。
- 區塊 2、3、4、5 的資料來源與 Guardrail（evidenceLevel、batchValidityReason、未投遞/樣本不足、規則缺失降級）保留，未因首頁重做洗掉。
- 帳號區降為次級（收合），首頁主視角為動作／商品／危險／黑馬。
- 區塊 5 明示「本輪尚未接入今日已調次數」及廣告層推測、規則缺失、資料不足勿亂動。

**first pass（尚未最終版，誠實標示）：**

- **todayActions 組法**：配額拼接（2+2+1+2→5），非全局影響力／急迫度排序；後續需升級為全局排序邏輯。
- **區塊 2 主判語**：前端固定模板一句，非動態總監語言層。
- **區塊 4 給投手／給設計一句話**：前端固定兩句，非依素材動態產出。
- **區塊 5**：節制提醒 guardrail 版，todayAdjustCount 未接入，非完整動作節制引擎。
- **batchValidity legacy**：legacy 仍為占位，未與 valid 嚴格區分。
- **在撐／在拖素材數**：區塊 2 規格要求之「在撐素材數」「在拖素材數」未接 API，未顯示；屬 Phase 3 或後續。

---

## 4. Staging 驗收結果

以下七項請於 **staging 部署完成後自驗**，並將結果回填至本節（或附於回報末）：

| # | 驗收項 | 結果（請回填） |
|---|--------|----------------|
| 1 | 首頁第一屏是否確實先看到五區，不再先看到帳號主視角 | 待 staging 自驗後回填 |
| 2 | 花費 0／under_sample／no_delivery 是否真的不進核心區 | 待 staging 自驗後回填 |
| 3 | evidenceLevel badge 是否真的出現在首頁核心決策區 | 待 staging 自驗後回填 |
| 4 | 區塊 1 的 directorVerdict 是否不是普通 reason 欄位照抄 | 待 staging 自驗後回填 |
| 5 | 區塊 2 主判語與區塊 4 投手／設計一句話，是否目前確實只是模板占位（請誠實標示） | 待 staging 自驗後回填 |
| 6 | 區塊 5 是否清楚標出「本輪尚未接入今日已調次數」 | 待 staging 自驗後回填 |
| 7 | 帳號區是否真的降為次級，不再搶首頁第一屏主角 | 待 staging 自驗後回填 |

---

## 5. 還剩哪些污染或不足（不粉飾）

- **todayActions**：目前為配額拼接，非全局真排序；影響力／急迫性／利潤風險／todayAdjustCount 尚未納入排序邏輯。
- **todayAdjustCount**：未接入，區塊 5 僅以 guardrail 提醒代替。
- **區塊 2 主判語**：前端模板占位，未接後端或 §41 動態產出。
- **區塊 4 給投手／給設計**：前端固定兩句，未依素材或 creative edge 動態產出。
- **區塊 2 在撐素材數／在拖素材數**：未接 API，未顯示。
- **batchValidity legacy**：與 valid 尚未嚴格區分，仍為占位。
- **evidenceLevel**：僅首頁核心決策區落地，商品主戰場／素材作戰台等尚未全站統一。
- **首頁**：尚未完全回答「靠哪些素材在撐／在拖」，屬 Phase 3 商品主戰場範疇。

---

## 6. 是否可進 Phase 3

- **can proceed to Phase 3 planning**：首頁已從帳號報表轉成決策骨架，五區骨架與四問（放大誰、止血誰、不要誤殺誰、延伸誰）可答，Guardrail 保留，可開始規劃 Phase 3（全局優先級排序、動態總監判語、todayAdjustCount、商品/素材在撐在拖等）。
- **cannot yet claim homepage fully final**：今日最該動的 5 件事仍為配額拼接、區塊 2/4 為模板占位、區塊 5 為節制 guardrail 版、legacy batch 未完成分流，故**不得**宣稱首頁已最終定版。

---

## 7. Commit hash

| 項目 | 值 |
|------|-----|
| **程式 commit** | **16ec9e5**（Phase 2A + Phase 2B 程式，已 push 至 origin/main） |
| **文件 commit** | **de57560**（本輪回報格式與完成語氣修正） |
| **staging 部署版本** | 依 Railway 設定；若自 main 自動 deploy，則為 push 後之 main 最新 commit（**de57560**）。可驗收網址：請以 Railway 專案之 staging 網址為準。 |

---

## 附：首頁四問與五區資料來源（參考）

| 問題 | 回答 |
|------|------|
| 今天先放大誰 | 區塊 1 type＝「放大」、區塊 2 主力商品「維持或小步放大」。 |
| 今天先止血誰 | 區塊 1 type＝「止血」、區塊 3 高預算危險。 |
| 今天不要誤殺誰 | 區塊 1 type＝「不要誤殺」、區塊 5 規則缺失／樣本不足勿亂動。 |
| 今天最值得延伸誰 | 區塊 1 type＝「值得延伸」、區塊 4 黑馬素材。 |

五區資料來源：皆來自 `GET /api/dashboard/action-center`（todayActions、productLevelMain、tableRescue、riskyCampaigns、tierHighPotentialCreatives、batchValidityReason、budgetActionNoDelivery/UnderSample、funnelEvidence）。Guardrail 見 Phase 2A 回報與本文件 §3。
