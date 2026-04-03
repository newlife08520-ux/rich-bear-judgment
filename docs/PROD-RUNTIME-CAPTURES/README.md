# PROD-RUNTIME-CAPTURES（Batch 12.3）

此目錄僅收 **正式環境去識別／合成** 的 JSON，**不得**與 `docs/LIVE-RUNTIME-CAPTURES/*.live.json`（seeded provenance v3）混放。

- `trustTier`: **`prod-sanitized`**
- 每檔必含 `captureMeta`：`source`、`trustTier`、`environment`（`production`）、`route`、`sanitized`、`generatedAt`；若有上游則填 `derivedFrom`。
- 若尚無真 prod HTTP capture，僅保留 `*.prod-sanitized.sample.json` 作形狀與審查對照；**不可**在文案中稱為「即時線上 raw」。

見 `docs/TRUTH-PACK-TRUST-LADDER.md`、`docs/API-SAMPLE-PAYLOADS.md`。
