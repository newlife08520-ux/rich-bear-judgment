# BATCH 16.1 — Meta 全域錯誤表面與商業驗證收尾（完成報告）

## 範圍

- **Meta 錯誤 UX（跨頁）**：`MetaApiErrorProvider`、`MetaGlobalErrorBanner`（`data-testid="meta-global-error-banner-v2"`）；Publish／首頁決策中心／FB 投放／審判工作臺在 Meta／網路失敗時寫入共用脈絡（`useReportMetaApiError` + `mapMetaOrNetworkErrorToActionability`）。
- **Granular**：`meta-error-ux` 納入 `docs/active/ACTIONABLE-ERROR-UX-MATRIX.md` 存在性檢查。
- **Generator**：交付時為 `batch16_1`；後續 **16.2** 已遞增至 `batch16_2`（見 `BATCH16.2-GEMINI-INTEGRATED-EXECUTION-COMPLETION-REPORT.md`）。

## 驗收

- `npm run check`
- `npm run verify:commercial-readiness`
- 發版封包前：`npm run verify:product-restructure`、`npm run create-review-zip:verified`

## 已知後續（不改本批次語意）

- routes／schema 更深 strangler、Out-of-band 與 Graph `updated_time` 之對照強化、更多 Tier D 真實脫敏樣本。
