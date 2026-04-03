# Phase：審判官結構化輸出優先 + 一鍵轉任務升級 - 完成回報

## 1. 完成狀態

**完成。** 結構化輸出優先與一鍵轉任務升級均已實作並接好前後端。

---

## 2. 已完成項目

### 一、結構化輸出優先

- **Shared 型別**：新增 `StructuredJudgment`、`StructuredJudgmentProblemType`、`StructuredJudgmentConfidence`，`ChatMessage` 新增選用欄位 `structuredJudgment`。
- **後端**：審判官 chat 的 system prompt 加上「結構化輸出」指示，要求模型在回覆最後以 \`\`\`json 輸出固定欄位（summary, nextAction, problemType, recommendTask, confidence, reasons, suggestions, evidence）。新增 `parseStructuredJudgmentFromResponse()`，從回覆中擷取 JSON 區塊並解析；解析成功則寫入 `assistantMessage.structuredJudgment` 並一併存進 session。
- **前端**：`JudgmentWorkbenchBubble` 優先使用 `message.structuredJudgment`，以 `mapStructuredToParsed()` 轉成裁決骨架；若無結構化則沿用 `parseJudgmentContent(message.content)` 當 fallback。摘要卡與詳細卡皆依同一套骨架渲染。

### 二、一鍵轉任務升級

- **預填欄位**：一鍵轉任務改為送出完整 payload：`title`、`action`、`reason`、`taskType`（由 problemType 對應）、`priority`（由 confidence 對應）、`taskSource: "審判官"`，以及選填 `productName`、`creativeId`、`impactAmount`（目前為 null，保留欄位供日後擴充）。
- **對應規則**：問題類型 → taskType：創意→creative、商品頁→landing_page、投放→fb_ads、漏斗→ga4_funnel。置信度 → priority：高→high、中→medium、低→low。
- **建立後導向**：建立成功後 toast「已建立任務，前往任務中心」，並自動 `setLocation("/tasks")` 跳轉任務中心。

---

## 3. 實際修改檔案

| 檔案 | 變更摘要 |
|------|----------|
| **shared/schema.ts** | 新增 `StructuredJudgment`、`StructuredJudgmentProblemType`、`StructuredJudgmentConfidence`、`structuredJudgmentSchema`；`ChatMessage` 新增 `structuredJudgment?`；`chatMessageSchema` 加入對應選用欄位。 |
| **server/rich-bear-prompt-assembly.ts** | 新增 `STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION` 常數，在組裝完的 system prompt 後由 routes 串接。 |
| **server/parse-structured-judgment.ts** | 新增：從 AI 回覆擷取 \`\`\`json 區塊、解析為 `StructuredJudgment`、正規化 problemType/confidence。 |
| **server/routes.ts** | 審判官 chat：system prompt 加上 `STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION`；取得 `assistantText` 後呼叫 `parseStructuredJudgmentFromResponse()`，若有結果則寫入 `assistantMessage.structuredJudgment`。 |
| **client/src/pages/judgment.tsx** | 新增 `TaskCreateFromJudgmentPayload`、`mapStructuredToParsed()`、`structuredConfidenceToKey()`、`PROBLEM_TYPE_TO_TASK_TYPE`；`JudgmentWorkbenchBubble` 改為優先使用 `message.structuredJudgment` 再 fallback parser；一鍵轉任務改為傳送完整 payload（taskType/priority/taskSource 等）；建立成功後 toast 並導向 `/tasks`。 |

---

## 4. 結構化輸出與 fallback 說明

| 情況 | 資料來源 | 說明 |
|------|----------|------|
| **走結構化** | `message.structuredJudgment` | 後端在 AI 回覆中成功解析出 \`\`\`json 區塊，且至少具備 `summary` 或 `nextAction`，並已寫入該則訊息的 `structuredJudgment`。前端直接使用該物件，經 `mapStructuredToParsed()` 轉成裁決骨架渲染。 |
| **走 fallback parser** | `parseJudgmentContent(message.content)` | 後端未解析到有效 JSON（模型沒照格式輸出、或沒有 \`\`\`json 區塊、或 JSON 無 summary/nextAction）。前端仍用既有 Markdown 標題 + 啟發式規則從 `message.content` 抽出總判決、先做什麼、問題類型、置信度等，與舊版行為一致。 |

因此：**有結構化就只用結構化；沒有才用前端 parser。** 舊對話（無 `structuredJudgment`）與新對話但模型未出 JSON 時，皆走 fallback。

---

## 5. 驗收步驟

1. **結構化優先**  
   - 在審判官送出一則判讀，若模型有在回覆最後輸出 \`\`\`json ... \`\`\` 且含 `summary` 或 `nextAction`，重新整理或重開對話後，該則助理訊息應有 `structuredJudgment`，摘要卡應依該欄位顯示。  
   - 若該則訊息沒有 `structuredJudgment`（例如舊資料或模型未出 JSON），畫面應仍以 fallback 解析 `content` 顯示，不應報錯。

2. **一鍵轉任務預填**  
   - 在裁決工作台點「一鍵轉任務」，建立成功後到任務中心，該任務應有：標題/動作/理由、任務類型（對應問題類型）、優先級（對應置信度）、任務來源「審判官」，且非空白任務。

3. **建立後導向**  
   - 一鍵轉任務成功後，應出現 toast「已建立任務，前往任務中心」，並自動跳轉至 `/tasks`。

4. **Parser fallback**  
   - 使用一則「僅有長文、無 JSON 區塊」的舊回覆或手動造一則無 `structuredJudgment` 的訊息，確認介面仍以卡片區塊顯示（由前端 parser 驅動），行為與改版前一致。

---

## 6. 未完成與原因

- **productName / creativeId / impactAmount 預填**：目前一鍵轉任務 payload 中這三個欄位固定為 `null`。審判官對話脈絡中尚無「當前商品名、素材 ID、影響金額」的傳遞，需日後由產品/素材選擇或 API 擴充再帶入，本輪僅保留欄位與型別。
- **建立後「前往該筆任務」**：目前為導向任務中心首頁；若需捲動到剛建立的任務（例如 `?highlight=id`），可再於任務中心頁面加 highlight 邏輯，本輪未實作。

---

## 7. 截圖

（請於實際環境執行上述驗收步驟後，依需要補上：  
- 有結構化時之裁決工作台摘要卡  
- 一鍵轉任務成功後任務中心之任務詳情  
- 建立成功後之 toast 與跳轉畫面）
