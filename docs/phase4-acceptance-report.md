# Phase 4 驗收報告

## 完成項目

### 1. 廢除 regex 抽 JSON

- **`server/gemini.ts`**：不再使用 ```(?:json)?\s*([\s\S]*?)``` 等 regex 抽取程式碼塊。
- **`extractJsonFromText(text)`**：先 `JSON.parse(trimmed)`；失敗則以首尾 `{`、`}` 擷取單一 JSON 物件再 parse。

### 2. 結構化輸出 + Runtime 驗證

- **`parseGeminiResponse`**：對 `parsed.summary` 做型別與列舉驗證（score 0–100、`VALID_GRADES`、`VALID_RECOMMENDATIONS`），組出 `ReportSummary` 與 `ModuleDetail`。
- **`parseContentJudgmentResponse`**：對解析結果做欄位驗證，回傳符合 `ContentJudgmentResult` 的物件。

### 3. Parse 失敗回 Fallback、不 Crash

- **Judgment**：`parseGeminiResponse` 改為永遠回傳 `{ summary, detail, isFallback }`；失敗時回傳 `buildFallbackSummary()` 與 `buildFallbackDetail(type)`，`callGeminiJudgment` 不再因 parse 失敗而回傳 null（僅 API 拋錯時回 null）。
- **Content Judgment**：`parseContentJudgmentResponse` 改為永遠回傳 `ContentJudgmentResult`，失敗時回傳 `FALLBACK_CONTENT_RESULT`。

## 驗收腳本與實際執行

| 腳本 | 說明 |
|------|------|
| `script/verify-phase4-gemini-fallback.ts` | 無效 JSON 觸發 isFallback、verdict 含「解析失敗」或「預設結果」、有效 JSON 解析正確 |

- **`npm run verify:phase4`**：執行上述腳本，fail-fast，全綠即通過。

## 備註

- API 呼叫失敗（網路、金鑰等）時，`callGeminiJudgment` / `callGeminiContentJudgment` 仍可能回傳 null，由路由處理並回傳適當 HTTP 狀態與訊息。
