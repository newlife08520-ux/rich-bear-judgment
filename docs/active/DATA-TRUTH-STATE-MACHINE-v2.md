# Data Truth State Machine v2

**Canonical v1**：`docs/active/DATA-TRUTH-STATE-MACHINE.md` + 程式 `shared/data-truth-state-machine.ts`。

## v2 硬化契約

- **鎖死狀態**：`partial_data`、`no_data`、`partial_decision` 等語意 **僅** 由此模組與 playbook 定義；UI 不得自創同義異名。
- **跨面一致**：首頁 truth 欄位見 `shared/homepage-data-truth.ts`（granular：`cross-surface-truth-consistency`）。
- **操作邊界**：partial 時「可做／不可做」細節見 `PARTIAL-VS-NO-DATA-PLAYBOOK-v2.md`；**集中矩陣 verify** 仍為後續可選強化（規格 `partial-ui-action-locking`）。
