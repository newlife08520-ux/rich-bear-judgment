# Verify 鏈遷移備註（v2）

## 原則

- **單一 canonical 交付鏈**：`verify:product-restructure` → `verify:commercial-readiness` →（release candidate）→ `create-review-zip:verified`。
- **不另開平行宇宙**：新語意以 `verify:commercial-readiness:*` **別名** 疊加，指向 `verify-commercial-readiness-granular.ts` 的單一任務，而非取代主鏈。

## 主鏈腳本

| npm script | 行為 |
|------------|------|
| `verify:commercial-readiness` | `verify-commercial-readiness-chain.ts` **後接** `verify-commercial-readiness-granular.ts all` |
| `verify:wave:commercial` | 等同 `npm run verify:commercial-readiness`（legacy umbrella 別名） |

## Granular 別名

- 形式：`verify:commercial-readiness:<task>` → `tsx script/verify-commercial-readiness-granular.ts <task>`
- 完整任務鍵可執行 `tsx script/verify-commercial-readiness-granular.ts` 無參數查看錯誤訊息中的列表，或見 `script/verify-commercial-readiness-granular.ts` 內 `tasks` 物件鍵。

## 與 v1 地圖關係

- `VERIFY-CHAIN-CANONICAL-MAP.md`：Batch 96 以降主敘事。
- `VERIFY-CHAIN-CANONICAL-MAP-v2.md`：補 commercial 子鏈與 product-restructure 掛載關係。

## Review pack

- 新增之 active 文件若屬審查必備，需同步 `script/lib/review-pack-required-materials.mjs` 與 `verify-review-zip-hygiene.ts` 內嵌清單。

## Batch 16.2（Gemini 整合）

- `verify:review-pack-contracts` 已含 `verify:batch101_3:truth-pack-tier-model-v3`（`TRUTH-PACK-TIER-MODEL-v3.md`）。
- `verify:commercial-readiness` granular 含 `commercial-readiness-gemini-doc-surface`；別名 `verify:commercial-readiness:gemini-doc-surface`。
