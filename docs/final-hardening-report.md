# Final Hardening 報告 — 華麗熊 AI 商業行銷審判系統

---

## Final 驗收定位

本報告結論為「**Final 可接受完成（Acceptable Final Hardening Complete）**」，表示核心高風險點已處理到可交付、可驗證、可回歸保護的程度；**並不主張**本系統已達「完美完成」或「所有驗收皆全自動完整覆蓋」的狀態。

`verify:final` 為**核心 regression suite**，覆蓋不需登入或外部服務即可執行的主要回歸項目；另有需伺服器/登入的驗收腳本已獨立保留，應於完整環境中執行。

---

## Rule alignment 實際接入點

`validateJudgmentAgainstSystemAction()` 已接進下列 production path：

| 項目 | 內容 |
|------|------|
| **檔案** | `server/routes.ts` |
| **函式 / 路徑** | `POST /api/content-judgment/chat` 的 request handler（約 L710–832） |
| **呼叫時機** | AI 回傳 `assistantText` 後、`parseStructuredJudgmentFromResponse(assistantText)` 完成後、組裝 `assistantMessage` 對外回傳前 |
| **傳入欄位** | 對齊用資料**不**來自 request body；後端依 request 可選的 `contextCampaignId` 從當前 batch 的 `precomputedActionCenter` 查詢，取得 **server-side** 的 `suggestedAction`/`suggestedPct` 後才呼叫 `validateJudgmentAgainstSystemAction`。 |
| **對齊結果** | 僅當能從 server-side 取得該 campaign 的系統判定時，才執行 alignment；若 `violated === true`，以 `alignedNextAction` 覆寫 `structuredJudgment.nextAction`，再將此 `structuredJudgment` 放進 `assistantMessage` 回傳。查不到 campaign 或 path 未接入時不做對齊。 |
| **前端配合** | 當使用者從 action-center / 某 campaign 的 rec 進入 audit 時，呼叫 chat API 可帶入 **`contextCampaignId`**（該 campaign 的 id），供後端定位並從 batch 取得 server-side 判定以執行對齊；未帶或後端查不到則不執行 alignment。 |

**尚未接入的路徑**：若其他 API 日後也回傳 `structuredJudgment` 或類似「AI 建議動作」欄位，且該路徑可取得系統 `suggestedAction`/`suggestedPct`，應同樣在組裝對外輸出前呼叫 `validateJudgmentAgainstSystemAction` 並覆寫。

---

## systemAction / systemPct 信任邊界

- 若 `systemAction`/`systemPct` 直接來自 request body 且未經伺服器驗證，存在被客戶端篡改的可能（例如系統實際為 decrease 15%，client 卻傳 `systemAction=increase`，alignment 可能被錯誤導向）。
- 本版已實作信任邊界補強，**alignment 僅依賴 server-side 可取得的系統判定**，不再信任 request body 的 `systemAction`/`systemPct`。

**現行實作與約定**（以下描述予以保留）：

1. **`contextCampaignId`** 只是讓後端**定位 campaign 的線索**（由前端在「從某 campaign 進入 audit」時帶入），**不是**權威 action 來源。
2. 真正用於 alignment 的 **`suggestedAction` / `suggestedPct`** 來自 **batch 的 server-side precomputed 資料**（`precomputedActionCenter` 內該 campaign 對應之筆），由後端依 `contextCampaignId` 查詢取得。
3. **若查不到該 campaign，或當前 path 尚未接入**（例如無 batch、無 precomputedActionCenter、或無對應 campaignId），則**不做 alignment**，不退回使用 request body 的 action/pct。
4. 此點屬於**信任邊界補強已完成**，**不列為 B 類缺口**。

---

## Retry integration 實際接入點

| Provider / 用途 | 所在位置 | Wrapper / fetch | Concurrency worker | withExponentialBackoff 套用處 | 會 retry 的錯誤 | 不 retry |
|------------------|----------|-----------------|---------------------|------------------------------|------------------|----------|
| Meta 帳號同步 | `server/refresh-pipeline.ts` L81–87 | 直接 `fetch( graph.facebook.com/me/adaccounts?... )` | 無（單次） | 包住整段 `fetch(...)` | 429、5xx、ECONNRESET/ETIMEDOUT/network、quota/rate limit | 4xx（非 429） |
| Meta campaign 數據 | 同檔 L128–137 | `fetchMetaCampaignData(...)`（內部為 Meta Graph API fetch） | `mapWithConcurrency(metaAccounts, REFRESH_FETCH_CONCURRENCY, (account) => withExponentialBackoff(() => fetchMetaCampaignData(...), { maxAttempts: 3 }))` | 包在 worker 內、每個 account 一次 | 同上 | 同上 |
| GA4 funnel 數據 | 同檔 L140–145 | `fetchGA4FunnelData(...)` | `mapWithConcurrency(ga4Accounts, ..., (account) => withExponentialBackoff(() => fetchGA4FunnelData(...), { maxAttempts: 3 }))` | 包在 worker 內 | 同上 | 同上 |
| Meta 多時間窗口 | 同檔 L167–169 | `fetchMultiWindowMetrics(...)` | `mapWithConcurrency(entries, ..., ([actId, camps]) => withExponentialBackoff(() => fetchMultiWindowMetrics(...), { maxAttempts: 3 }))` | 包在 worker 內 | 同上 | 同上 |
| GA4 頁面數據 | 同檔 L182–186 | `fetchGA4PageData(...)` | `mapWithConcurrency(ga4Accounts, ..., (account) => withExponentialBackoff(() => fetchGA4PageData(...), { maxAttempts: 3 }))` | 包在 worker 內 | 同上 | 同上 |

Retry 行為由 `server/lib/retry.ts` 的 `isRetryableError`、`withExponentialBackoff` 決定；僅對可重試錯誤重試，最多 3 次，指數退避。

---

## Event loop yield 說明

Event loop yield 已落地於已知大型迴圈，並有驗收腳本確認 helper 與 pipeline 呼叫路徑存在；**若需更強證據**，可再補 heartbeat / timer drift 等 runtime 驗證。

- **實作**：`server/lib/event-loop-yield.ts` 提供 `yieldToEventLoop()`、`shouldYield(index, every)`；`server/refresh-pipeline.ts` 在「計算三維評分」迴圈每 50 次、「異常檢測」accountGroups 迴圈每 30 次呼叫 `await yieldToEventLoop()`。
- **驗證**：`verify-phase3-event-loop-yield.ts` 檢查上述 helper 與 pipeline 呼叫存在。
- **不宣稱**：已完成性能保證、完全解決 event loop starvation、或以 runtime benchmark 證明不阻塞。

---

## Phase 4 定位

Phase 4 已完成「**extractJsonFromText + schema-based runtime validation + fallback**」的穩定版交付，確保 parse 或 schema 驗證失敗時不致造成 API crash 或 response shape 崩潰。

**不宣稱**：已完成「完整 structured outputs 架構」或 provider-native structured output，除非已實際接上該能力。

**後續優化**：Provider-native structured output / JSON mode 若 provider 與 SDK 條件允許，仍可作為後續強化項，不阻擋本次交付。

---

## Final 驗收覆蓋矩陣

| 驗收項 | 腳本 | 納入 verify:final | 為何未納入（若未納入） | 需要條件 | 最近一次結果 |
|--------|------|-------------------|------------------------|----------|--------------|
| phase2 acceptance | verify-phase2-acceptance.ts | 是 | — | 本地、fixture | 通過 |
| phase2 lifecycle | verify-phase2-lifecycle.ts | 是 | — | 本地、REFRESH_TEST_MODE=fixture | 通過 |
| phase2 failure-no-pollute | verify-phase2-failure-no-pollute.ts | 是 | — | 本地、FORCE_REFRESH_FAILURE_STAGE | 通過 |
| phase2 auth-cross-user | verify-phase2-auth-cross-user.ts | 否 | 需伺服器與兩組帳密 | 伺服器、登入 | 獨立執行 |
| precompute headers | verify-precompute-headers.ts | 否 | 需伺服器與登入、precomputed 資料 | 伺服器、登入 | 獨立執行 |
| phase3 concurrency | verify-phase3-concurrency.ts | 是 | — | 本地 | 通過 |
| phase3 retry integration | verify-phase3-retry-integration.ts | 是 | — | 本地、mock | 通過 |
| phase3 no-memory-storage | verify-phase3-no-memory-storage.ts | 是 | — | 本地 | 通過 |
| phase3 upload cleanup | verify-phase3-upload-cleanup.ts | 是 | — | 本地 | 通過 |
| phase3 workbench bulk | verify-phase3-workbench-bulk.ts | 是 | — | 本地 | 通過 |
| phase3 retry wrapped | verify-phase3-retry-wrapped.ts | 是 | — | 本地 | 通過 |
| phase3 event loop yield | verify-phase3-event-loop-yield.ts | 是 | — | 本地 | 通過 |
| phase4 fallback | verify-phase4-gemini-fallback.ts | 是 | — | 本地 | 通過 |
| phase4 schema validation | verify-phase4-schema-validation.ts | 是 | — | 本地 | 通過 |
| phase5 prompt guardrails | verify-phase5-prompt-guardrails.ts | 是 | — | 本地 | 通過 |
| phase5 context compression | verify-phase5-context-compression.ts | 是 | — | 本地 | 通過 |
| phase5 rule alignment | verify-phase5-rule-alignment.ts | 是 | — | 本地 | 通過 |
| phase5 no-contradictory-budget | verify-phase5-no-contradictory-budget.ts | 是 | — | 本地、mock | 通過 |
| phase5 production alignment path | verify-phase5-production-alignment-path.ts | 是 | — | 本地、fixture | 通過 |

---

## verify:final 實際組成（17 支）

1. script/verify-phase2-acceptance.ts  
2. script/verify-phase2-lifecycle.ts  
3. script/verify-phase2-failure-no-pollute.ts  
4. script/verify-phase3-concurrency.ts  
5. script/verify-phase3-retry-integration.ts  
6. script/verify-phase3-no-memory-storage.ts  
7. script/verify-phase3-upload-cleanup.ts  
8. script/verify-phase3-workbench-bulk.ts  
9. script/verify-phase3-retry-wrapped.ts  
10. script/verify-phase3-event-loop-yield.ts  
11. script/verify-phase4-gemini-fallback.ts  
12. script/verify-phase4-schema-validation.ts  
13. script/verify-phase5-prompt-guardrails.ts  
14. script/verify-phase5-context-compression.ts  
15. script/verify-phase5-rule-alignment.ts  
16. script/verify-phase5-no-contradictory-budget.ts  
17. script/verify-phase5-production-alignment-path.ts  

---

## 未解風險 — 分兩類

### A. 已完成但可再優化（不阻擋交付）

- **Provider-native structured output**：屬進一步平台化強化，不阻擋本次交付。  
- **結構化 logging**：屬可觀測性成熟度提升，不阻擋本次交付。  
- **更強的 runtime performance benchmark（如 heartbeat / timer drift）**：屬可再補強的量化驗證，不阻擋本次交付。  
- **systemAction / systemPct 信任邊界**：信任邊界補強已完成——alignment 僅依 server-side（batch + precomputedActionCenter）取得之 `suggestedAction`/`suggestedPct` 執行；`contextCampaignId` 僅作定位用，查不到或 path 未接入時不做 alignment。此項不列為 B 類缺口（詳見上文「systemAction / systemPct 信任邊界」）。  

### B. 本階段原本該完成但目前仍未完成

**（已清空）**

---

## Final 結論的語氣

### 可以寫

- Final 可接受完成  
- 核心高風險點已完成交付級硬化  
- 已有回歸腳本與實際驗證輸出  
- 未破壞 phase 1 / phase 2 成果  
- `validateJudgmentAgainstSystemAction` 已接進 production path（content-judgment chat），且具 production-alignment-path 驗收  

### 不可以寫

- 完美完成  
- 所有驗收皆跨環境完整自動化覆蓋  
- 所有自動化驗收完整無遺漏  
- 再無任何值得追蹤之風險  
- 所有 structured output 能力都已到位  

---

## 實際 stdout 摘要

### `npm run verify:phase5`

```
通過：Phase 5 Prompt 護欄與 context 壓縮行為正確。
通過：context 壓縮有效，過長內容已截斷且尾段未進入 prompt。
通過：Output 由系統計算、Data Context 含建議動作，規則對齊已就緒。
通過：Phase 5 無矛盾預算（deterministic alignment）驗證完成。
通過：production path 對齊保護已驗證（parse -> align -> 對外輸出已覆寫）。
```

### `npm run verify:final`

```
[verify:final] Running verify-phase2-acceptance.ts...
... 結果: 通過
[verify:final] Running verify-phase2-lifecycle.ts...
通過：lifecycle pending → running → succeeded ...
...（依序 17 支）
[verify:final] Running verify-phase5-production-alignment-path.ts...
通過：production path 對齊保護已驗證（parse -> align -> 對外輸出已覆寫）。
[verify:final] All regression checks passed.
```

---

## 結論

- **Final 可接受完成（Acceptable Final Hardening Complete）。**  
- Production path 已接入對齊 helper（`POST /api/content-judgment/chat` 在組裝 `assistantMessage` 前，**僅在能從 server-side 取得系統判定時**（request 帶 `contextCampaignId` 且 batch 中有該 campaign）才以該筆的 `suggestedAction`/`suggestedPct` 呼叫 `validateJudgmentAgainstSystemAction` 並在違反時覆寫 `structuredJudgment.nextAction`；無法取得 server-side 值時不以 request body 的 `systemAction`/`systemPct` 作為對齊依據）。  
- 新增 `verify-phase5-production-alignment-path.ts` 已納入 `verify:phase5`、`verify:final`，並通過。  
- `verify:final` 已更新為 17 支腳本並實際執行通過。  
- 報告已改為「Final 可接受完成」、精準用語與邊界說明，不宣稱完美完成或全覆蓋。  
- 未破壞：phase 1 precomputed 讀路徑、phase 2 refresh job / publish / recovery / auth、既有 dashboard response shape。  
