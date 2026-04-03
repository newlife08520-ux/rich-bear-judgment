# Meta／網路錯誤 → 可操作 UX 對照

| 情境 | 典型 HTTP／Graph 線索 | 使用者可執行動作 | UI 元件／文案方向 |
|------|------------------------|------------------|-------------------|
| Token 無效／過期 | 401、OAuth 錯誤碼 | 重新授權、檢查設定頁 Token | `mapMetaOrNetworkErrorToActionability` → `reauth` |
| 權限不足 | 403、(#200) 等 | 確認 ads_read／ads_management、換帳號 | 說明缺少權限＋設定連結 |
| 限流 | 429、rate limit 訊息 | 稍後重試、減少批次操作 | 倒數或「稍後重試」CTA |
| 暫時性錯誤 | 5xx、timeout | 重試、只讀檢視 | 不覆蓋草稿、保留本地狀態 |
| 業務拒絕 | 4xx 帶具體 subcode | 依訊息修正欄位或改走 dry-run | Gate 內顯示可修項目 |

## 實作錨點

- 前端：`client/src/lib/meta-error-actionability.ts`
- 投放 Gate：`PublishExecutionGateDialog`／`usePublishWorkbench` meta 路徑
- Runbook：`META-ERROR-HANDLING-RUNBOOK.md`

## 禁止

- 靜默失敗（不 toast、不寫稽核、不更新 draft 狀態）。
- 將錯誤誤顯示為「成功」或空白畫面無說明。
