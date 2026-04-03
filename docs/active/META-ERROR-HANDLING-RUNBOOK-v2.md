# Meta Error Handling Runbook v2

**Canonical v1**：`docs/active/META-ERROR-HANDLING-RUNBOOK.md`（分類表與 Publish 路徑）。

## v2 硬化（全域可見）

- **統一對照**：`mapMetaOrNetworkErrorToActionability`（401→reauth、403→check_permissions、429→retry_later 等）。
- **全域橫幅**：`MetaApiErrorProvider` + `MetaGlobalErrorBanner`（TTL 約 15 分）；非僅 dialog／toast。
- **回報面**：Publish、首頁決策中心、FB 投放、審判工作臺等於 Meta／網路失敗時寫入脈絡。
- **稽核**：execution 事件仍入 DB／`GET /api/execution/logs`（與 v1 一致）。
