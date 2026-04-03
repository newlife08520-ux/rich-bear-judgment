# Tier D Dirty Account Pack：覆蓋矩陣

| 樣本檔（`docs/SANITIZED-DB-SNAPSHOTS/`） | 壓測焦點 |
|------------------------------------------|----------|
| `tier-d-dirty-longtail-zero-spend.json` | 極長尾、零花費分類、是否誤當健康帳戶放大 |
| `tier-d-dirty-pacing-sparse.json` | 稀疏樣本、節奏／歸因延遲敘事是否穩定 |
| `tier-d-dirty-dormant-noisy.json` | 休眠復甦噪音、`lowConfidenceDormant` 是否降權 |

## 關聯模組

- Dormant／可見性：`shared/visibility-policy.ts`（含 `lowConfidenceDormant`、noise clamp）
- Pacing：`shared/goal-pacing-engine.ts`、`server/modules/goal-pacing/build-product-pacing.ts`
- Pareto／多層級：既有 verify batch29 鏈

## 使用方式

- 僅供 **離線／測試** 與 reviewer 解讀；不得當作真實客戶 raw DB。
- 新增髒樣本時更新本矩陣與 `TIER-D-DIRTY-ACCOUNT-PACK.md` 主檔。
