# SCHEMA-SPLIT-PROGRESS-A（Batch 15.9）

- **已拆**：`shared/schema/recommendation-level.ts`（recommendationLevels／getRecommendationLevel），由 `shared/schema.ts` re-export。  
- **已拆**：`shared/schema/publish-draft-contract.ts`（PublishDraft／PublishTemplate／publishStatuses 等），由 `shared/schema.ts` re-export。  
- **下一步**：execution／creative／visibility 其餘型別分批出 `shared/schema/*.ts`，維持單一 `import "@shared/schema"` 對外介面。
