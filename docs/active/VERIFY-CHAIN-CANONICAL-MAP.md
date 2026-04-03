# VERIFY-CHAIN-CANONICAL-MAP（Batch 15.3）

## 正式交付主鏈（約 30 秒可記住）

| 命令 | 用途 |
|------|------|
| `npm run verify:release-candidate` | **主閘門**：core 回歸 + product-restructure + ops + reviewer-trust |
| `npm run verify:product-restructure` | UI／智慧層 + 審查材料契約（不含 precompute／baseline） |
| `npm run create-review-zip:verified` | 先 `inner:prep` → wrap（batch68/73）→ 封 ZIP → batch73_1 → `inner:postZip` |
| `npm run verify:final` | **別名** → 等同 `verify:release-candidate` |

## 分層 canonical（由內到外）

- **verify:ui-core** — `check` + dashboard scope + scope integrity + no-mock + AI contract + rule-alignment production paths  
- **verify:intelligence** — batch28_1–28_3、batch29、batch29_1（Pareto／ledger／goal pacing）  
- **verify:review-pack-contracts** — batch97–102（文件邊界、首頁 v12、沉睡 v7、Judgment v12、truth tier、routes／schema 第一刀）  
- **verify:reviewer-trust** — batch96 系列（鏈地圖、別名、inner 入口）  
- **verify:review-pack** — reviewer-trust + review-pack-contracts  
- **verify:ops** — precompute + baseline  
- **verify:full** — ui-core + intelligence + review-pack + ops + core-regression（**legacy umbrella 別名目標**）

## 與 ZIP／manifest

- `script/lib/review-pack-generator-version.mjs` 之 `REVIEW_PACK_GENERATOR_VERSION` 須與本輪敘事一致（現：`batch15_9`，對齊 `phase-batch15_9-complete`）。  
- `docs/REVIEW-PACK-MANIFEST.json` 之 `phaseLabel` 須與 `REVIEW-PACK-CONTENTS.json` 對齊；`create-review-zip-verified.txt` 尾段須含當輪 `zipName`。
