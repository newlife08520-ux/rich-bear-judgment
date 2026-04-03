# 07 — EXECUTION LAYER AND META INTEGRATION

## 架構錨點

- **模組**：`server/modules/execution/`（`execution-service`、`execution-routes`、`execution-repository`、`execution-handler-registry`、各 `handlers/*`）。  
- **型別**：`execution-types.ts`、`execution-handler-types.ts`。  
- **前端閘門**：`ExecutionGateDialog`；`useMetaExecutionGate`（FB）、`useTasksExecutionGate`（任務）、`useJudgmentTaskExecutionGate`（審判官建任務）。

## Dry-run／Apply／Logs

| 項目 | 狀態 | 說明 |
|------|------|------|
| Dry-run 先行 | **已成熟（模式上）** | 多數破壞性路徑先記錄意圖再確認 |
| Apply 寫入稽核 | **可用／Partial** | 依 handler；需確認各 UI 是否皆經同一套 gate |
| Logs／可追溯 | **Partial** | 後端有儲存與路由；產品「一鍵看懂昨日誰改了什麼」仍非全站一致 |

## Rollback note

- 資料模型與腳本層有「可驗收的 rollback／稽核語意」；**UI 是否每次都向使用者展示 rollback 提示** 需逐頁對照，**不可假設**全站已產品化完成。

## Meta operator actions

- **Handlers 存在**：`meta-campaign-pause-handler`、`meta-campaign-resume-handler`、`meta-campaign-update-budget-handler` 等。  
- **FB 頁整合**：`FbAdsPageView` 使用 `ExecutionGateDialog` + `useMetaExecutionGate`。  
- **狀態**：**可用但仍 Partial** — 真寫入依 token、權限、Graph API 錯誤；失敗重試與使用者預期需實測。

## Publish draft／Meta foundation

- **Handlers**：`publish-draft-create-handler`、`publish-draft-update-handler`、`publish-draft-batch-create-handler`、`meta-publish-draft-execute-handler`。  
- **產品表面**：`/publish`、`/publish/history` 仍多為 **placeholder／導向**（見 Stage0）；與「完整發佈控制台」有落差。  
- **區分**：後端 **foundation 已鋪**；前端產品化與「一鍵上線到 Meta 商業閉環」**尚未完成**。

## Feature flags／gating

- Execution 路徑普遍依 **確認勾選**、session、與後端驗證；細節以 `execution-routes` 與各 hook 為準。  
- **審查建議**：grep `EXECUTION`、`dryRun`、`apply` 於 client，列出所有入口是否皆有 gate。

## 成熟度總表

| 區塊 | 已成熟 | 可用但 Partial | 尚未完成 |
|------|--------|----------------|----------|
| 審判官 → 建任務 dry-run／apply | ✓ 主路徑 | 邊界錯誤 UX | — |
| 任務工作台 batch | ✓ 模式 | 大規模批次極限 | — |
| FB pause／resume／budget | ✓ handler | 權限／API 失敗敘事 | — |
| Publish draft 管線 | foundation | UI | 完整商業 publish |
| 全站統一「執行歷史」體驗 | — | Partial | 終局產品 |

## 真正「publish to Meta」做到哪

- **做到**：draft 建立／更新／批次與 execute handler 等 **工程結構**。  
- **未做到**：使用者可從 Publish 頁無縫完成與 Dashboard／CI 對齊的 **端到端產品故事**。  
- **風險**：demo 時若只展示「有 API」易誤導；應以 **頁面與 verify 覆蓋** 為準。

## 下一步

- 將 Publish 從 placeholder 收斂成最小閉環（單一 happy path + 明確錯誤）。  
- 統一 execution log 的讀取 UI（若產品目標包含合規）。  
- Meta 錯誤碼映射為可行動文案（rate limit、權限不足）。
