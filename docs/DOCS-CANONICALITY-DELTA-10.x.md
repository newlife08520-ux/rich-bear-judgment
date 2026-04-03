# Docs canonicality delta（Batch 10.7–11.1）

## Canonical runtime paths

- **Seeded LIVE**：`docs/LIVE-RUNTIME-CAPTURES/*.live.json` — `trustTier: seeded-runtime-explicit-provenance-v3`.
- **Staging**：`docs/STAGING-RUNTIME-CAPTURES/` — 與 LIVE **分目錄**；占位見 `_staging-runtime-separated.placeholder.json`.
- **敘述規則**：`docs/TRUTH-PACK-CANONICALITY-RULES.md`、`docs/TRUTH-PACK-TRUST-LADDER.md`.

## Review pack

- `generatorVersion`: **batch11.1**（`REVIEW-PACK-CONTENTS.json` / `create-review-zip.mjs`）。
- 信任基線：`docs/REVIEW-PACK-TRUST-BASELINE.md`（本輪補 STAGING 路徑）。

## UI truth

- 首頁第一屏：`section-homepage-first-screen-command-v6`；Judgment focus：`judgment-focus-strip-v7`。
- 沉睡主線：`DormantGemsWorkflowRibbon` + `DormantGemsSurfaceSection`；樣本 `DormantGemCandidates.v3.sample.json`。
