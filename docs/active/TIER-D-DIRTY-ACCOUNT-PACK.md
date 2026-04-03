# Tier D Dirty Account Pack（契約樣本）

## 定位

- **Tier D**：標示為脫敏／壓測用 **dirty** 結構化樣本，**非**線上 production 匯出。
- 用途：驗證 dormant 降噪、Pareto、節奏敘事在極端長尾／稀疏樣本下不爆炸。

## 檔案（`docs/SANITIZED-DB-SNAPSHOTS/`）

| 檔案 | 情境 |
|------|------|
| `tier-d-dirty-longtail-zero-spend.json` | 大量 0 spend 長尾 |
| `tier-d-dirty-pacing-sparse.json` | 稀疏點擊／轉換 |
| `tier-d-dirty-dormant-noisy.json` | 沉睡候選雜訊 |

## 與引擎

- `shared/visibility-policy.ts`：`lowConfidenceDormant`、`DORMANT_NOISE_*` 門檻。
- Goal pacing：`learningPhaseProtected`（`shared/goal-pacing-engine.ts`）。

## Reviewer

- 審查時必讀檔首 `tier` 與 `note` 欄位；勿當真實客戶資料。
