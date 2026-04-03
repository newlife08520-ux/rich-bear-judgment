# SCHEMA-SPLIT-PROGRESS v16（Batch 16.x strangler）

延續 `docs/active/SCHEMA-SPLIT-PROGRESS-A.md`（Batch 15.9）。

## 本階段已落地

- **Publish 契約**：`shared/schema/publish-draft-contract.ts`，由 `shared/schema.ts` re-export；granular：`schema-split-publish`。

## 下一刀

- execution／creative／visibility 等型別依 A 檔案所述拆出 `shared/schema/*.ts`，**維持**對外僅 `import from "@shared/schema"`。
