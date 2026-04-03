# BATCH 16.2 — Gemini 整合規格執行（完成報告）

## 範圍

- Ground truth：`docs/active/GEMINI-RECONCILIATION-BATCH16.2.md`。
- 審查材料擴充：v2／v3／vNext 文件（見 `commercial-readiness-gemini-doc-surface` granular）。
- Verify：`verify:batch101_3:truth-pack-tier-model-v3` 納入 `verify:review-pack-contracts`；`cross-surface-execution-links` 強化（儀表／商品／發佈／FB）。
- ZIP：`docs/active/*` 新檔列入 `review-pack-required-materials`（與 hygiene 同步）。

## Generator

- `REVIEW_PACK_GENERATOR_VERSION`：`batch16_2`（與 `script/lib/review-pack-generator-version.mjs`、`REVIEW-PACK-CONTENTS.json` 對齊）。

## 驗收

- `npm run verify:product-restructure`
- 發版：`npm run verify:release-candidate`、`npm run create-review-zip:verified`

## 刻意未在本輪做大爆炸

- routes／schema Progress **B** 僅契約文件；程式 strangler 待專門批次。
- 真 staging／prod capture：維持 tier 誠實與 placeholder 規則，不偽造。
