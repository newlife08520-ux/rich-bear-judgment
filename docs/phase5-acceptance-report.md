# Phase 5 驗收報告

## 完成項目

### 1. Prompt 護欄

- **`server/rich-bear-prompt-assembly.ts`**：新增 `MAX_CUSTOM_MAIN_PROMPT_CHARS = 8000`、`MAX_DATA_CONTEXT_CHARS = 16000`。
- **`truncateWithSuffix(s, max, suffix)`**：超過 max 時截斷並加上「…（已截斷）」。
- 組裝時 `customMainPrompt`、`dataContext` 皆經截斷後才放入 layers，避免單一區塊過長導致 token 爆量。

### 2. Context 壓縮

- Data Context 與視角 Overlay 皆受字數上限限制，等同於 context 壓縮（只保留前 N 字元）。

### 3. AI 輸出與規則引擎對齊

- **STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION** 已包含與規則引擎/前端對齊的欄位：`summary`、`nextAction`、`problemType`、`recommendTask`、`confidence`、`score`、`blockingReasons`、`pendingItems` 等；`passed`/`threshold` 由系統依 score 與門檻計算，不在 AI 輸出中。

## 驗收腳本與實際執行

| 腳本 | 說明 |
|------|------|
| `script/verify-phase5-prompt-guardrails.ts` | 檢查長度常數、過長 customMainPrompt/dataContext 被截斷且含「已截斷」、尾端不進入 prompt、Output Schema 含 score/problemType |

- **`npm run verify:phase5`**：執行上述腳本，fail-fast，全綠即通過。
