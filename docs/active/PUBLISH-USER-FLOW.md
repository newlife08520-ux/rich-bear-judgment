# Publish 使用者流程（MVP）

1. **進入投放中心** `/publish` → 見草稿列表或空狀態。
2. **建立投放草稿**：選帳戶／粉專／素材包／版本／文案／預算 → 精靈三步 → 「建立」觸發 `publish_draft_create` 之 dry-run → Gate（僅 DB）→ apply。
3. **編輯／複製／變體**：同精靈，`publish_draft_update` 或批次 `publish_draft_batch_create`。
4. **送往 Meta**：列表「送往 Meta（預覽）」→ `meta_publish_draft_execute` dry-run → Gate（**meta** 文案）→ apply（受 `EXECUTION_ALLOW_META_WRITES` 等約束）。
5. **稽核**：同頁「執行紀錄」對話框或側欄 **全域執行稽核** `/execution-history`。

## 異常

- Token／權限／Rate limit：見 `META-ERROR-HANDLING-RUNBOOK.md`；UI 經 `mapMetaOrNetworkErrorToActionability` 於 Meta 路徑顯示可行动摘要。
