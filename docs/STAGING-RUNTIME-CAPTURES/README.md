# STAGING-RUNTIME-CAPTURES

**Batch 10.8**：此目錄僅放 **staging／長連線** 消毒後的 HTTP capture，**不得**與 `docs/LIVE-RUNTIME-CAPTURES/*.live.json`（seeded supertest 衍生）混放。

- 占位：`_staging-runtime-separated.placeholder.json`（`trustTier: staging-sanitized`，`payload: null`）。
- 真實 staging 檔名請自訂，但必須在 `captureMeta` 標明與 seeded 不同的 `trustTier`／`source`。

見 `docs/TRUTH-PACK-CANONICALITY-RULES.md`、`docs/LIVE-RUNTIME-CAPTURES/SEEDED-VS-STAGING.md`。
