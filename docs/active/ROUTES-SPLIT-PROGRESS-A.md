# ROUTES-SPLIT-PROGRESS-A（Batch 15.9）

- **已移出 `server/routes.ts`**：`/api/dashboard/cross-account-summary`、`today-verdict`、`today-priorities`、`high-risk`、`business-overview` → `server/routes/dashboard-truth-routes.ts`。  
- **已移出 `server/routes.ts`**：`/api/fb-ads/*`（含 opportunities、campaigns-scored）→ `server/routes/fb-ads-api-routes.ts`（`registerFbAdsApiRoutes`）。  
- **下一步**：`action-center`、`data-confidence` 等同質 dashboard API 再分批抽出（不與 workbench／judgment 混檔）。
