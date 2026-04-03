# TRUTH-PACK-TIER-MODEL v3（四層明確化）

**上層模型**：`docs/active/TRUTH-PACK-TIER-MODEL-v2.md`（仍為 canonical 表格式摘要）。本檔為 **Gemini 整合規格** 之口徑鎖定：四層 **標籤語意** 與 **禁止偽造** 規則。

## 四層（A–D）

| Tier | 標籤語意 | 典型來源 |
|------|----------|----------|
| **Tier A** | illustrative／synthetic（示意、教學、非宣稱真帳） | 手繪／合成範例 |
| **Tier B** | seeded-runtime（本機或固定種子 dev／supertest／腳本擷取） | `docs/LIVE-RUNTIME-CAPTURES/` 多數現檔 |
| **Tier C** | staging-sanitized（真 staging 經脫敏流程） | 須附 `STAGING-CAPTURE-CONTRACT-v2.md` provenance |
| **Tier D** | prod-sanitized（真 prod 經脫敏／聚合） | `docs/SANITIZED-DB-SNAPSHOTS/` 與 `TIER-D-*` 文件 |

## 強制規則

- **無真擷取則不得宣稱 C/D**：檔案與 `SCREENSHOT-TO-DATA-MAP.md`／`API-SAMPLE-PAYLOADS.md` 須標 tier；缺資料時用 **placeholder + provenance 欄**（見 `STAGING-CAPTURE-CONTRACT-v2.md`）。
- **Reviewer**：`npm run verify:batch101`（v2）+ `npm run verify:batch101_3:truth-pack-tier-model-v3`（本檔結構）。
