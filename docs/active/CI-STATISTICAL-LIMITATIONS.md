# Creative Intelligence：統計限制說明（產品層）

## 為何需要常駐揭露

CI 彙總 Pareto、休眠寶石、模式層與行動建議；若無明確限制說明，易被誤讀為「即時完整真理」，與歸因延遲、小樣本現實衝突。

## 介面錨點

- `client/src/pages/creative-intelligence.tsx`：
  - `data-testid="ci-statistical-disclosure"`：歸因延遲、樣本量、跨平台對齊
  - `ci-low-confidence-demotion-hint`：degraded／降級時降權解讀
  - `ci-learning-phase-protected-hint`：學習期與 `learningPhaseProtected` 敘事

## 與後端契約

- 模式 API 若回傳 `degraded` 或缺欄位，前端不得高亮誤導性「必做」CTA；應與 execution 稽核、實際 batch 交叉驗證。

## 驗證

- `verify:commercial-readiness:ci-statistical-disclosure`、`ci-low-confidence-demotion`（granular）。
