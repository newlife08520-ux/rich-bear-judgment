# VERIFY-CHAIN-CANONICAL-MAP v2

## 主交付鏈（不變）

| 命令 | 用途 |
|------|------|
| `npm run verify:release-candidate` | core 回歸 + product-restructure + ops + reviewer-trust |
| `npm run verify:product-restructure` | ui-core + intelligence + review-pack-contracts + **commercial-readiness** |
| `npm run create-review-zip:verified` | 封包前完整鏈 + capture + hygiene |

## 新增：商業救火層

| 命令 | 用途 |
|------|------|
| `npm run verify:commercial-readiness` | `verify-commercial-readiness-chain.ts`（103–112）**＋** `verify-commercial-readiness-granular.ts all`（細項別名契約） |
| `npm run verify:wave:commercial` | 同上之別名（僅 commercial 子鏈） |

## Legacy 別名（保留）

- `verify:final` → `verify:release-candidate`
- `verify:wave:legacy-umbrella` → `verify:full`

## Generator

- `script/lib/review-pack-generator-version.mjs`：`REVIEW_PACK_GENERATOR_VERSION` 與封包 JSON 對齊（商業波次：`batch16_2`，見 `docs/active/BATCH16.2-GEMINI-INTEGRATED-EXECUTION-COMPLETION-REPORT.md`）。

## Review pack contracts（truth tier）

- `verify:review-pack-contracts` 含 **`verify:batch101_3:truth-pack-tier-model-v3`**（錨定 `docs/active/TRUTH-PACK-TIER-MODEL-v3.md`）。

## 詳細批次對照

- 仍以 `docs/active/VERIFY-CHAIN-CANONICAL-MAP.md` 為 Batch 96 以降敘事主檔；**v2** 補上 commercial 子鏈與別名，避免僅從舊圖找不到 `verify:commercial-readiness`。
