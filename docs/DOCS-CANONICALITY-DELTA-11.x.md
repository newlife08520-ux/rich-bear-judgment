# Docs canonicality delta（Batch 11.x）

## Batch 11.6

- **active**：`docs/active/BATCH11.2`–`BATCH11.6-COMPLETION-REPORT.md` 為本輪 reviewer-facing 完成回報；與 `verify:batch63:reviewer-readiness-completion-reports` 清單對齊。
- **root `docs/`**：truth 三角（`SCREENSHOT-TO-DATA-MAP.md`、`UI-TRUTH-MAPPING.md`、`API-SAMPLE-PAYLOADS.md`）為跨頁對照之 canonical；archive 不放現行 UI testid 之唯一真相來源。
- **generated metadata**：`docs/REVIEW-PACK-MANIFEST.json` 內 `zipName` 須與 `docs/VERIFY-FULL-OUTPUTS/create-review-zip-verified.txt` 同輪次記錄一致（`verify:batch73_1`）。

## Batch 11.7

- **Review pack order**：`npm run create-review-zip:verified` 先跑 `inner:prep` → wrap 寫入 canonical log → `batch68`／`batch73` → **最後** `create-review-zip.mjs` 封 ZIP；ZIP 內 `create-review-zip-verified.txt` 須為 `exit=0` 且含當輪 `zipName`（`verify:batch78`、`verify:batch78_1`）。
- **active**：`docs/active/BATCH11.7-COMPLETION-REPORT.md` 記錄 packaging canonicality 根因與修法。

## 與 10.x 之差異

- 首頁第一屏 testid 升級為 `section-homepage-first-screen-command-v7`；審判 Focus strip 為 `judgment-focus-strip-v8`。
- API 樣本檔頂部增加四分節標（Illustrative / Canonical runtime-aligned / Seeded LIVE JSON / Staging placeholder）。
