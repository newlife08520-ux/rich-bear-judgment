# Publish MVP Closure v2（硬化敘事）

**Canonical v1**：`docs/active/PUBLISH-MVP-CLOSURE.md`。本檔只補 **商業硬化與驗證契約**，不重複全文。

## 真閉環定義（可稽核）

1. **預覽**：使用者觸發「送往 Meta（預覽）」→ `executionDryRun("meta_publish_draft_execute")` → Gate UI。
2. **套用**：確認後 `executionApply` → 後端 handler 依 guard 寫入 Meta（Stage1 最小實體，PAUSED 等語意見限制文件）。
3. **可觀測**：
   - **Execution**：`/execution-history` 與各頁「執行紀錄」對話框可見對應事件。
   - **草稿**：`PublishDraft` 狀態與列表與後端一致。
   - **失敗**：`mapMetaOrNetworkErrorToActionability` + toast／gate 錯誤 + 可選全域 `MetaGlobalErrorBanner`。

## 非誤導聲明

- 非「全自動投放平台」；完整創編／多資產矩陣仍為 **foundation + 最小寫入**。
- 環境無有效 token 或 guard 關閉時，**不**承諾寫入成功。

## Reviewer 驗證

- `npm run verify:commercial-readiness`（含 `publish-mvp`、`publish-meta-write-foundation`、`publish-ui-no-placeholder`）。
- 實機：截圖 + `docs/RUNTIME-QUERY-CAPTURES/`／`LIVE-RUNTIME-CAPTURES/` 須標 **Tier**（見 `TRUTH-PACK-TIER-MODEL-v3.md`）。
