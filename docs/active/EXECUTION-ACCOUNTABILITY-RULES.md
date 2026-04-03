# Execution 問責規則

## 目的

讓「誰在何時對哪個實體做了什麼」可從 **全域 execution 稽核** 與 **底層 ledger** 一致追溯，符合商業上線與 reviewer trust。

## 欄位語意（頁面層）

- **時間**：以伺服器記錄之 ISO 時間為準。
- **Actor**：`ai`／`human`／`system`（依 execution payload 與登入身分判定）。
- **動作類型**：與 `execution-handler-registry` 之 handler id 對齊（例如 `meta_publish_draft_execute`）。
- **標的**：campaign／adset／ad／draft 等 entity key 與 id。
- **舊值／新值**：以 API 與儲存層可取得之快照為限；無則標 `null` 並在摘要說明。
- **結果**：`dry_run`／`applied`／`failed`／`rolled_back`（或等價枚舉）；失敗須附可讀訊息與錯誤碼（若有）。

## 與產品邏輯邊界

- 本規則**不**重新定義 visibility、dormant、pacing、pareto 的商業 if／else；僅要求 **執行面** 可稽核、可對外敘述一致。
- AI 憲法與引擎數據解耦：稽核紀錄不得混入「隱藏校準」內容；僅記錄對外可說明的動作與參數。

## 驗證

- `verify:commercial-readiness:execution-history`、`audit-accountability`（granular）。
