# DOCS-CANONICALITY-RULES（Batch 15.4）

## 分層

| 區域 | 內容 |
|------|------|
| **docs/active/** | 當期營運／審判／verify 契約、完成報告（本輪 BATCH15.x）、canonical map、truth／homepage／judgment 設計稿 |
| **docs/archive/** | 歷史 BATCH 完成報告與凍結敘事（只讀） |
| **docs/generated/** | （可選）僅放機讀生成物；若未使用目錄則以 `generate:stage0-audit` 寫入 `docs/active/` 為準 |
| **docs/** 根層 | 審查包索引（`REVIEW-PACK-*.json`）、執行期擷取目錄、`API-SAMPLE-PAYLOADS.md`、`UI-TRUTH-MAPPING.md`、`SCREENSHOT-TO-DATA-MAP.md`、`OPEN-ISSUES-AND-BLOCKERS.md`、`DELETE-CANDIDATES.md` 等 **少數入口** |

## 禁止

- 在 `docs/` 根層新增 `BATCH*-COMPLETION-REPORT.md`（應在 `active/` 或 `archive/`）。  
- 將 **Tier B** 擷取冒充 **Tier C/D**（見 `TRUTH-PACK-TIER-MODEL-v2.md`）。
