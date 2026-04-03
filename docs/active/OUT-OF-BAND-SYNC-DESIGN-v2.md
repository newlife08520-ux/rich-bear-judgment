# Out-of-band Sync Design v2

**Canonical v1**：`docs/active/OUT-OF-BAND-SYNC-DESIGN.md`（機制與 UI 主敘事）。

## v2 硬化重點（對照規格）

1. **External edit 定義**：未經本系統 `executionApply`、於 Meta 原生後台變更預算／有效狀態等，且與上次 ingest 快照不一致（見 `computeOutOfBandHints`）。
2. **校準**：`acknowledge-external-drift` + `resetAdjustCountsForUserToday`（今日 adjust 節奏歸零）。
3. **表面**：`ExternalMetaDriftBanner`；首頁／商品／預算／審判／投放等掛載點以程式為準（granular：`external-change-warning-surface`）。

## 仍待實作（不偽造 capture）

- Graph `updated_time` 與快照 `metaUpdatedAt` **並列比對**（v1 末節「v2 強化方向」已預告）。
