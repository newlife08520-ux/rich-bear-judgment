# Phase：深連結收尾 - 完成回報

## 1. 完成狀態

**完成。** 素材生命週期已支援 creativeId 深連結（篩選、滾動、高亮）；投放按鈕依任務 context 帶入 productName/creativeId；impactAmount 支援結構化與 evidence 推導，並有明確 fallback。

---

## 2. 已完成項目

### 一、素材生命週期支援 creativeId

- **讀取**：`/creative-lifecycle?creativeId=` 由 `getCreativeIdFromUrl(location)` 解析。
- **篩選**：`displayItems` = 當有 creativeId 時，篩選 `items` 中 `i.id === creativeId` 或 `i.name` 含 creativeId 者；無則顯示全部。未命中時顯示「未找到 ID 或名稱含「xxx」的素材，顯示全部」。
- **滾動**：對命中之第一筆卡片設 `ref={highlightCardRef}`，`useEffect` 內 `scrollIntoView({ behavior: "smooth", block: "center" })`。
- **高亮**：該卡片 `className` 加上 `ring-2 ring-primary bg-primary/5`。

**說明**：生命週期 API 目前回傳的 `item.id` 為 campaignId；任務的 creativeId 可能為 Meta 素材/廣告 ID。以「id 完全相符」或「name 包含 creativeId」做匹配，可涵蓋 campaign 維度與名稱關鍵字。

### 二、投放中心深連結更精準

- **任務列「投放」按鈕**：有 `productName` 時連結 `/publish?productName=<encode>`；無 productName 但有 `creativeId` 時連結 `/publish?creativeId=<encode>`；皆無則 `/publish`。title 依序為「前往投放（預填商品：xxx）」「前往投放中心（帶入素材）」「前往投放中心」。
- **投放頁**：讀取 `?productName=`（與 `?creativeId=`，目前僅解析保留），`useEffect` 將 `productNameFromUrl` 寫入表單 `form.productName`，建立草稿時即預填商品名。
- **Fallback**：任務無 productName/creativeId 時仍連 `/publish`；投放頁未實作依 creativeId 篩選草稿（資料模型目前無任務→草稿 ID），creativeId 僅保留於 URL 供日後擴充。

### 三、impactAmount 自動推導（最低限度）

- **結構化**：`StructuredJudgment` 新增選用欄位 `impactAmount`；後端 `parseStructuredJudgmentFromResponse` 若 JSON 內有 `impactAmount` 則直接採用。
- **從 evidence/summary 推導**：後端 `extractAmountFromText(evidence || summary || nextAction)`，規則依序為：
  - `約/大約/估計 + N 萬` → `約 N 萬`
  - `N 萬` → `N 萬`
  - `NT $...` 或 `...元` → 原樣擷取
  - `影響...N 萬` → `約 N 萬`
- **前端**：`ParsedJudgment` 新增 `impactAmount`；`mapStructuredToParsed` 帶入 `s.impactAmount`；`parseJudgmentContent` 的 fallback 會從「影響金額/影響/impactAmount」區塊或 `extractAmountFromText(reason + evidence + verdict)` 帶入。
- **一鍵轉任務**：`impactAmount` 優先使用 `parsed.impactAmount`（結構化或 parser 推導），再 fallback `ctx.impactAmount`（URL），再 null。
- **Prompt**：結構化輸出指示中已加入 `impactAmount` 欄位說明，鼓勵模型從證據推估並輸出。

---

## 3. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| **client/src/pages/creative-lifecycle.tsx** | 新增 `getCreativeIdFromUrl`、`creativeIdFromUrl`、`highlightCardRef`；`displayItems` 依 creativeId 篩選；未命中提示；卡片 ref + 高亮 class；`useEffect` 滾動至高亮卡；`cn` import。 |
| **client/src/pages/tasks.tsx** | 「投放」按鈕改為 `productName ? /publish?productName= : creativeId ? /publish?creativeId= : /publish`，title 依 context 區分。 |
| **client/src/pages/publish-placeholder.tsx** | 新增 `getPublishUrlParams`、`useLocation`、`useEffect`；依 `?productName=` 預填 `form.productName`；`?creativeId=` 僅解析保留。 |
| **shared/schema.ts** | `StructuredJudgment` 新增 `impactAmount?: string`；`structuredJudgmentSchema` 新增 `impactAmount`。 |
| **server/parse-structured-judgment.ts** | 新增 `extractAmountFromText`（約 N 萬、N 萬、NT$、影響…萬）；解析時 `impactAmount` 優先用 JSON 欄位，否則用 `extractAmountFromText(evidence+summary+nextAction)`。 |
| **server/rich-bear-prompt-assembly.ts** | 結構化輸出指示中新增 `impactAmount` 欄位說明。 |
| **client/src/pages/judgment.tsx** | `ParsedJudgment` 新增 `impactAmount`；`mapStructuredToParsed`、`parseJudgmentContent` 帶入/推導 impactAmount；新增 `extractAmountFromText`（與後端規則一致）；一鍵轉任務 payload 使用 `parsed.impactAmount || ctx.impactAmount`。 |

---

## 4. deep link 與 impactAmount 補全邏輯

### 深連結

| 目標 | 條件 | 連結 | 目標頁行為 |
|------|------|------|-------------|
| 素材生命週期 | 任務有 creativeId | `/creative-lifecycle?creativeId=` | 篩選 id/name 含該值，滾動並高亮第一筆；無則顯示全部與提示。 |
| 投放中心 | 任務有 productName | `/publish?productName=` | 預填表單 productName。 |
| 投放中心 | 任務僅有 creativeId | `/publish?creativeId=` | 目前僅帶參數，頁面未用；保留供日後對應草稿/素材。 |
| 投放中心 | 皆無 | `/publish` | 一般進入。 |

### impactAmount 補全順序

1. **結構化**：AI 回覆 JSON 內有 `impactAmount` → 直接使用。
2. **後端推導**：無結構化欄位時，`extractAmountFromText(evidence + summary + nextAction)`，規則見上。
3. **前端 parser**：無結構化時，從 Markdown 區塊「影響金額/影響/impactAmount」或 `extractAmountFromText(reason + evidence + verdict)`。
4. **URL**：審判頁 `?impactAmount=` 帶入的 `ctx.impactAmount`。
5. **null**：以上皆無則不帶。

---

## 5. 驗收步驟

1. **素材 creativeId**：在任務中心找一筆有 creativeId 的任務（或手動建立），點「素材」→ 應進入 `/creative-lifecycle?creativeId=xxx`，列表篩選到對應素材、該卡高亮並滾動到視野內。若 creativeId 對應不到任何 item，應顯示「未找到…」並顯示全部。
2. **投放 productName**：有 productName 的任務點「投放」→ 進入 `/publish?productName=xxx`，開「建立投放草稿」時表單商品名應已為該值。
3. **impactAmount**：審判官回覆中（結構化 JSON 或內文）含「約 5 萬」「NT$10000」「影響 3 萬」等，一鍵轉任務後該任務的影響金額欄位應有值；無則可再以 URL `?impactAmount=` 測試 fallback。

---

## 6. 未完成與原因

- **投放依 creativeId 篩選/對應草稿**：目前任務與草稿模型無直接關聯，`/publish?creativeId=` 僅保留參數，未在頁面做篩選或預填。
- **素材生命週期 item.id 與 Meta creativeId 一致**：生命週期 API 目前以 campaign 為單位，`id` 為 campaignId；若任務的 creativeId 為 Meta 廣告/素材 ID，可能需後端擴充「創意維度」或 ID 對照後，深連結才能精準對到同一素材。

---

## 7. 截圖

（請於實際環境依驗收步驟操作後，視需要補上：素材篩選與高亮、投放預填商品名、任務影響金額欄位。）
