# Meta／Graph 錯誤處理 Runbook

## 攔截點

- HTTP：`executionDryRun` / `executionApply` 非 2xx 時拋錯，訊息來自 JSON `message`。
- 前端對照：`client/src/lib/meta-error-actionability.ts` → `mapMetaOrNetworkErrorToActionability`。

## 分類與建議動作

| 情境 | primaryAction | 使用者動作 |
|------|---------------|------------|
| Token／OAuth | reauth | 設定重新連結 Meta |
| 權限 #200／403 | check_permissions | 檢查應用程式與廣告帳戶角色 |
| Rate limit 429 | retry_later | 稍後重試、降低頻率 |
| 網路／暫態 | retry_later | 重試；僅檢視時可依已同步批次唯讀 |

## Publish Meta 路徑

- `usePublishWorkbench` 在 `meta` 模式之 apply／dry-run 錯誤會帶入上述標題＋說明。

## 首頁／Judgment／FB

- 重大異常仍以各頁 API 錯誤與 toast／banner 呈現；本 runbook 為**對照表**，非取代各模組 UI。

## 全域橫幅（Batch 16.1）

- **脈絡**：`client/src/context/meta-api-error-context.tsx`（`MetaApiErrorProvider`、約 15 分鐘 TTL 之最後一筆可行动錯誤）。
- **表面**：`client/src/components/meta/MetaGlobalErrorBanner.tsx`（關閉、連結設定／發佈脈絡）；掛載於已登入壳層 `App.tsx`（`MetaGlobalErrorBanner` 於主內容上方）。
- **回報點**：`usePublishWorkbench`、`useDashboardDecisionCenter`、`useFbAdsWorkbench`、`useJudgmentWorkbench` 於 Meta dry-run／apply 或對應 API 失敗時呼叫 `useReportMetaApiError`。
- **矩陣**：可行动文案與測試矩陣見 `docs/active/ACTIONABLE-ERROR-UX-MATRIX.md`。
