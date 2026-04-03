# Out-of-band Sync 設計

## 問題

使用者在 **Meta 原生後台** 修改預算／有效狀態時，若未經本系統 execution，本地 ingest 快照與「營運心智」可能脫節。

## 機制

1. **快照**：每次 refresh job 成功 `saveBatch` 後，`persistMetaCampaignSnapshotsFromBatch` 將各 campaign 的 `dailyBudgetMinor`、`effectiveStatus`、`metaUpdatedAt` 寫入 `MetaCampaignBudgetSnapshot`（來自 `meta-data-fetcher` 擴充欄位）。
2. **探測**：`GET /api/sync/out-of-band-hints` 以目前 FB token 對快照內 campaign 呼叫 Graph，比對即時 `daily_budget`（第一個 adset）與 `effective_status`。
3. **校準**：`POST /api/sync/acknowledge-external-drift` 將今日 `WorkbenchAdjustDaily.adjustCount` 歸零（節奏重新對齊）。

## UI

- `ExternalMetaDriftBanner`：首頁／商品／預算／審判／投放中心；`data-testid="external-meta-drift-banner"`。

## Tier

- 即時 Graph 為 **runtime**；快照為 **post-ingest**；與 Tier B/C 審查包分開標註。

## v2 強化方向（文件契約，實作分批）

- **時間維度**：除預算／狀態外，可將 Graph `updated_time` 與快照 `metaUpdatedAt` 並列比對，降低「數值相同但後台曾異動」的漏報（須注意權限與欄位可用性）。
- **表面**：維持 `ExternalMetaDriftBanner` 多頁一致；與 `GET /api/sync/out-of-band-hints` 契約同步演進時應更新本檔與 granular `out-of-band-sync` 對照。
