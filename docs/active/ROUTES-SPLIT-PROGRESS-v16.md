# ROUTES-SPLIT-PROGRESS v16（Batch 16.x strangler）

延續 `docs/active/ROUTES-SPLIT-PROGRESS-A.md`（Batch 15.9）。

## 本階段已落地（不重述 domain 語意）

- **FB／儀表 API**：`server/routes/fb-ads-api-routes.ts`（`registerFbAdsApiRoutes`），由 `server/routes.ts` 組裝；granular：`routes-split-meta-ops`。
- **Publish**：`server/modules/publish/publish-routes.ts`（`publishRouter`）自 `routes.ts` 掛載。

## 下一刀（僅搬移／匯總，不改行為）

- Dashboard 剩餘同質端點（action-center、data-confidence 等）依 A 檔案所述分批抽出。
- GA4／其他大型區塊維持「先 strangler 模組、再削 `routes.ts` 行數」節奏。
