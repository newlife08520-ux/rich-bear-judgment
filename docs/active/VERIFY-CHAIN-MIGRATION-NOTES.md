# VERIFY-CHAIN-MIGRATION-NOTES

## 舊命名（歷史 umbrella／batch 區間）

- 舊 `verify:batch10_7-11_1`、`batch12_3-to-12_7`、`batch14_1-to-14_6` 等已自 `package.json` 移除（淨化）。行為由 **verify:full**／**verify:release-candidate** 與現存單檔 `verify-phase*.ts`／`verify-x281.ts` 等覆蓋。

## 新 canonical 命名

- 見 `VERIFY-CHAIN-CANONICAL-MAP.md`。

## 保留別名

- `verify:final` → `verify:release-candidate`  
- `verify:wave:legacy-umbrella` → `verify:full`（舊「大 umbrella」心智模型）

## 未來可刪

- 若全員已改跑 `verify:release-candidate`／`verify:full`，可評估移除 `verify:wave:legacy-umbrella`。  
- Phase2–5 細粒度 `verify:phase2:*` 仍保留供除錯；正式交付不必逐一手動串。
