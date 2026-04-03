# SCHEMA-SPLIT-PROGRESS B（Batch 16.5 契約）

**前置**：`docs/active/SCHEMA-SPLIT-PROGRESS-A.md`、`SCHEMA-SPLIT-PROGRESS-v16.md`。

## B 階目標

- 自 `shared/schema.ts` 再拆：`execution`／`creative`／`visibility` 等型別子檔，**一律 re-export**；對外仍 `import from "@shared/schema"`。

## 驗收

- `verify:commercial-readiness:schema-split-publish`（現況）+ build／tsc 綠。
