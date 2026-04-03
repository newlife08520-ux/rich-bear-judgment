# REVIEW-PACK-TRUST-BASELINE（Batch 15.4）

- **主鏈**：`verify:release-candidate` 通過後才執行 `create-review-zip:verified`。  
- **ZIP 內證據**：`docs/VERIFY-FULL-OUTPUTS/create-review-zip-verified.txt` 首行 `exit=0`，且含當輪 `zipName`。  
- **Truth 誠實**：擷取檔須標 Tier（`TRUTH-PACK-TIER-MODEL-v2.md`）；禁止 seeded 冒充 staging／prod。  
- **generatorVersion**：與 `script/lib/review-pack-generator-version.mjs` 一致（本輪 `batch15_8`）。
