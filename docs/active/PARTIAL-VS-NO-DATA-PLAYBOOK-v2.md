# Partial vs No Data Playbook v2

**Canonical v1**：`docs/active/PARTIAL-VS-NO-DATA-PLAYBOOK.md`。

## v2 對齊方式

- **單一真相來源**：狀態機 `shared/data-truth-state-machine.ts`；各頁顯示層僅解讀，不重寫閾值。
- **Reviewer**：`verify:commercial-readiness:data-truth` + `partial-no-data-separation`。
- **截圖／API sample**：須在對應 map 標 **Tier**（`TRUTH-PACK-TIER-MODEL-v3.md`）。
